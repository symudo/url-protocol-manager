//go:build windows

package winutil

import (
	"bytes"
	"encoding/base64"
	"image"
	"image/color"
	"image/png"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"syscall"
	"unsafe"

	"golang.org/x/sys/windows"
)

var (
	modOle32          = windows.NewLazySystemDLL("ole32.dll")
	modShell32        = windows.NewLazySystemDLL("shell32.dll")
	modUser32         = windows.NewLazySystemDLL("user32.dll")
	modGdi32          = windows.NewLazySystemDLL("gdi32.dll")
	procCoInitialize  = modOle32.NewProc("CoInitializeEx")
	procCoUninit      = modOle32.NewProc("CoUninitialize")
	procExtractIconEx = modShell32.NewProc("ExtractIconExW")
	procSHGetFileInfo = modShell32.NewProc("SHGetFileInfoW")
	procGetIconInfo   = modUser32.NewProc("GetIconInfo")
	procDestroyIcon   = modUser32.NewProc("DestroyIcon")
	procGetDC         = modUser32.NewProc("GetDC")
	procReleaseDC     = modUser32.NewProc("ReleaseDC")
	procGetObject     = modGdi32.NewProc("GetObjectW")
	procGetDIBits     = modGdi32.NewProc("GetDIBits")
	procDeleteObject  = modGdi32.NewProc("DeleteObject")
)

const (
	coinitApartmentThreaded = 0x2
	shgfiIcon               = 0x000000100
	shgfiLargeIcon          = 0x000000000
	biRGB                   = 0
	dibRGBColors            = 0
)

// InitCOMThread locks the current goroutine to an OS thread and initializes COM (STA)
// as required by Shell APIs such as SHGetFileInfoW. Call the returned cleanup via defer.
func InitCOMThread() func() {
	runtime.LockOSThread()
	hr, _, _ := procCoInitialize.Call(0, coinitApartmentThreaded)
	// S_OK (0) or S_FALSE (1) require a matching CoUninitialize call.
	needUninit := hr == 0 || hr == 1
	return func() {
		if needUninit {
			procCoUninit.Call()
		}
		runtime.UnlockOSThread()
	}
}

type shFileInfo struct {
	hIcon         uintptr
	iIcon         int32
	dwAttributes  uint32
	szDisplayName [260]uint16
	szTypeName    [80]uint16
}

type iconInfo struct {
	fIcon    int32
	xHotspot uint32
	yHotspot uint32
	hbmMask  uintptr
	hbmColor uintptr
}

type bitmapInfoStruct struct {
	bmType       int32
	bmWidth      int32
	bmHeight     int32
	bmWidthBytes int32
	bmPlanes     uint16
	bmBitsPixel  uint16
	bmBits       uintptr
}

type bitmapInfoHeader struct {
	biSize          uint32
	biWidth         int32
	biHeight        int32
	biPlanes        uint16
	biBitCount      uint16
	biCompression   uint32
	biSizeImage     uint32
	biXPelsPerMeter int32
	biYPelsPerMeter int32
	biClrUsed       uint32
	biClrImportant  uint32
}

var iconCache sync.Map

func unsafePointer[T any](p *T) unsafe.Pointer {
	return unsafe.Pointer(p)
}

// ClearIconCache clears the in-memory icon data URL cache.
func ClearIconCache() {
	iconCache.Range(func(key, _ any) bool {
		iconCache.Delete(key)
		return true
	})
}

// ExtractIconDataURL extracts an icon from iconSpec (or fallbackExe) and encodes it as a PNG data URL.
func ExtractIconDataURL(iconSpec, fallbackExe string) string {
	cacheKey := strings.ToLower(strings.TrimSpace(iconSpec)) + "|" + strings.ToLower(strings.TrimSpace(fallbackExe))
	if cached, ok := iconCache.Load(cacheKey); ok {
		return cached.(string)
	}

	result := extractIconUncached(iconSpec, fallbackExe)
	iconCache.Store(cacheKey, result)
	return result
}

func extractIconUncached(iconSpec, fallbackExe string) string {
	path, index := ParseIconLocation(iconSpec)
	if !FileExists(path) {
		path = fallbackExe
		index = 0
	}
	if !FileExists(path) {
		return ""
	}

	ext := strings.ToLower(filepath.Ext(path))
	if ext == ".png" {
		if raw, err := os.ReadFile(path); err == nil && len(raw) > 0 && len(raw) < 2*1024*1024 {
			return "data:image/png;base64," + base64.StdEncoding.EncodeToString(raw)
		}
	}

	hIcon := loadHIcon(path, index)
	if hIcon == 0 && fallbackExe != "" && !strings.EqualFold(path, fallbackExe) && FileExists(fallbackExe) {
		hIcon = loadHIcon(fallbackExe, 0)
	}
	if hIcon == 0 {
		return ""
	}
	defer procDestroyIcon.Call(hIcon)

	img := hIconToImage(hIcon)
	if img == nil {
		return ""
	}

	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		return ""
	}
	return "data:image/png;base64," + base64.StdEncoding.EncodeToString(buf.Bytes())
}

func loadHIcon(path string, index int) uintptr {
	pathPtr, err := syscall.UTF16PtrFromString(path)
	if err != nil {
		return 0
	}

	var largeIcon uintptr
	ret, _, _ := procExtractIconEx.Call(
		uintptr(unsafe.Pointer(pathPtr)),
		uintptr(int32(index)),
		uintptr(unsafe.Pointer(&largeIcon)),
		0,
		1,
	)
	if ret > 0 && largeIcon != 0 {
		return largeIcon
	}

	// Fallback to SHGetFileInfoW for .ico or shell-registered files
	var shfi shFileInfo
	r, _, _ := procSHGetFileInfo.Call(
		uintptr(unsafe.Pointer(pathPtr)),
		0,
		uintptr(unsafe.Pointer(&shfi)),
		unsafe.Sizeof(shfi),
		shgfiIcon|shgfiLargeIcon,
	)
	if r != 0 && shfi.hIcon != 0 {
		return shfi.hIcon
	}
	return 0
}

func hIconToImage(hIcon uintptr) image.Image {
	var info iconInfo
	ret, _, _ := procGetIconInfo.Call(hIcon, uintptr(unsafe.Pointer(&info)))
	if ret == 0 {
		return nil
	}
	if info.hbmColor != 0 {
		defer procDeleteObject.Call(info.hbmColor)
	}
	if info.hbmMask != 0 {
		defer procDeleteObject.Call(info.hbmMask)
	}

	if info.hbmColor == 0 {
		return nil
	}

	var bm bitmapInfoStruct
	if r, _, _ := procGetObject.Call(info.hbmColor, unsafe.Sizeof(bm), uintptr(unsafe.Pointer(&bm))); r == 0 {
		return nil
	}
	w, h := int(bm.bmWidth), int(bm.bmHeight)
	if w <= 0 || h <= 0 || w > 512 || h > 512 {
		return nil
	}

	hdc, _, _ := procGetDC.Call(0)
	if hdc == 0 {
		return nil
	}
	defer procReleaseDC.Call(0, hdc)

	bih := bitmapInfoHeader{
		biSize:        uint32(unsafe.Sizeof(bitmapInfoHeader{})),
		biWidth:       int32(w),
		biHeight:      -int32(h), // top-down DIB
		biPlanes:      1,
		biBitCount:    32,
		biCompression: biRGB,
	}

	colorBits := make([]byte, w*h*4)
	r, _, _ := procGetDIBits.Call(
		hdc,
		info.hbmColor,
		0,
		uintptr(h),
		uintptr(unsafe.Pointer(&colorBits[0])),
		uintptr(unsafe.Pointer(&bih)),
		dibRGBColors,
	)
	if r == 0 {
		return nil
	}

	// Check whether the icon already carries an alpha channel
	hasAlpha := false
	for i := 3; i < len(colorBits); i += 4 {
		if colorBits[i] != 0 {
			hasAlpha = true
			break
		}
	}

	var maskBits []byte
	if !hasAlpha && info.hbmMask != 0 {
		maskBits = make([]byte, w*h*4)
		procGetDIBits.Call(
			hdc,
			info.hbmMask,
			0,
			uintptr(h),
			uintptr(unsafe.Pointer(&maskBits[0])),
			uintptr(unsafe.Pointer(&bih)),
			dibRGBColors,
		)
	}

	img := image.NewNRGBA(image.Rect(0, 0, w, h))
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			idx := (y*w + x) * 4
			b := colorBits[idx]
			g := colorBits[idx+1]
			r := colorBits[idx+2]
			a := colorBits[idx+3]
			if !hasAlpha {
				if len(maskBits) == len(colorBits) && maskBits[idx] != 0 {
					a = 0
				} else {
					a = 255
				}
			}
			img.SetNRGBA(x, y, color.NRGBA{R: r, G: g, B: b, A: a})
		}
	}
	return img
}
