//go:build windows

package winutil

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestExpandEnvVars(t *testing.T) {
	got := ExpandEnvVars(`%SystemRoot%\System32\notepad.exe`)
	if strings.Contains(got, "%SystemRoot%") || !strings.HasSuffix(strings.ToLower(got), `\system32\notepad.exe`) {
		t.Fatalf("unexpected expanded path: %q", got)
	}
}

func TestExtractExecutablePath(t *testing.T) {
	winDir := os.Getenv("SystemRoot")
	notepad := filepath.Join(winDir, "System32", "notepad.exe")

	cases := []struct {
		name string
		cmd  string
		want string
	}{
		{
			name: "quoted path with args",
			cmd:  `"` + notepad + `" "%1"`,
			want: notepad,
		},
		{
			name: "env var quoted path",
			cmd:  `"%SystemRoot%\System32\notepad.exe" "%1"`,
			want: notepad,
		},
		{
			name: "bare system command",
			cmd:  `notepad.exe "%1"`,
			want: notepad,
		},
		{
			name: "non-existent path with spaces",
			cmd:  `C:\NonExistent Folder\My App\demo.exe "%1"`,
			want: `C:\NonExistent Folder\My App\demo.exe`,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := ExtractExecutablePath(tc.cmd)
			if !strings.EqualFold(got, tc.want) {
				t.Fatalf("ExtractExecutablePath(%q) = %q, want %q", tc.cmd, got, tc.want)
			}
		})
	}
}

func TestParseIconLocation(t *testing.T) {
	p, idx := ParseIconLocation(`"C:\Program Files\App\app.exe",-101`)
	if p != `C:\Program Files\App\app.exe` || idx != -101 {
		t.Fatalf("got (%q, %d), want (%q, -101)", p, idx, `C:\Program Files\App\app.exe`)
	}

	p2, idx2 := ParseIconLocation(`C:\Tools\app.exe,0`)
	if p2 != `C:\Tools\app.exe` || idx2 != 0 {
		t.Fatalf("got (%q, %d), want (%q, 0)", p2, idx2, `C:\Tools\app.exe`)
	}
}

func TestExtractIconDataURL(t *testing.T) {
	notepad := filepath.Join(os.Getenv("SystemRoot"), "System32", "notepad.exe")
	dataURL := ExtractIconDataURL(`"`+notepad+`",0`, notepad)
	if !strings.HasPrefix(dataURL, "data:image/png;base64,") {
		t.Fatalf("expected PNG data URL for notepad.exe, got prefix: %.30q", dataURL)
	}
}
