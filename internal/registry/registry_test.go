//go:build windows

package registry

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	winreg "golang.org/x/sys/windows/registry"
)

func TestValidateProtocolName(t *testing.T) {
	valid := []string{"myapp", "my-app", "my.app+1", "A123"}
	for _, v := range valid {
		if err := ValidateProtocolName(v); err != nil {
			t.Errorf("expected %q to be valid, got err: %v", v, err)
		}
	}

	invalid := []string{"", " ", ".txt", "1abc", "my app", "my:app", `a\b`, "a/b", "中文协议"}
	for _, iv := range invalid {
		if err := ValidateProtocolName(iv); err == nil {
			t.Errorf("expected %q to be invalid, but got nil", iv)
		}
	}
}

func TestScanAllLiveRegistry(t *testing.T) {
	items, err := ScanAll()
	if err != nil {
		t.Fatalf("ScanAll() failed: %v", err)
	}
	if len(items) == 0 {
		t.Fatalf("expected at least 1 custom URL protocol on Windows, got 0")
	}
	t.Logf("Scanned %d custom URL protocols on local machine", len(items))
}

func TestFullLifecycleCRUDExportImportAndBatchClean(t *testing.T) {
	suffix := fmt.Sprintf("%d", time.Now().UnixNano()%1000000)
	scheme := "upmtest" + suffix
	stale1 := "upmstale1" + suffix
	stale2 := "upmstale2" + suffix

	// Ensure zero leftover registry keys even on failure
	t.Cleanup(func() {
		_ = DeleteProtocol(ScopeHKCU, scheme, DeleteModeFull)
		_ = DeleteProtocol(ScopeHKCU, stale1, DeleteModeFull)
		_ = DeleteProtocol(ScopeHKCU, stale2, DeleteModeFull)
	})

	notepad := filepath.Join(os.Getenv("SystemRoot"), "System32", "notepad.exe")

	// 1. Create standard 4-level protocol in HKCU
	err := CreateProtocol(ProtocolPayload{
		Name:        scheme,
		Scope:       ScopeHKCU,
		Description: "URL:UPM Test Protocol",
		Command:     fmt.Sprintf(`"%s" "%%1"`, notepad),
		IconPath:    fmt.Sprintf(`"%s",0`, notepad),
	})
	if err != nil {
		t.Fatalf("CreateProtocol failed: %v", err)
	}

	// Duplicate creation must be rejected
	if err := CreateProtocol(ProtocolPayload{
		Name:    scheme,
		Scope:   ScopeHKCU,
		Command: fmt.Sprintf(`"%s" "%%1"`, notepad),
	}); err == nil {
		t.Fatalf("expected duplicate CreateProtocol to fail")
	}

	// Verify scan picks it up with healthy status and icon
	items, err := ScanAll()
	if err != nil {
		t.Fatalf("ScanAll failed: %v", err)
	}
	found := findByID(items, "HKCU:"+scheme)
	if found == nil {
		t.Fatalf("created protocol %s not found in ScanAll", scheme)
	}
	if found.Health != HealthOK || found.Cleanable {
		t.Fatalf("expected health=ok cleanable=false, got health=%s cleanable=%v", found.Health, found.Cleanable)
	}
	if !strings.HasPrefix(found.IconData, "data:image/png;base64,") {
		t.Fatalf("expected extracted PNG icon data for %s", scheme)
	}

	// Add an unrelated custom value & subkey to verify UpdateProtocol never destroys unrelated data
	k, err := winreg.OpenKey(winreg.CURRENT_USER, hkcuClassesPath+`\`+scheme, winreg.SET_VALUE|winreg.CREATE_SUB_KEY)
	if err != nil {
		t.Fatalf("open test key failed: %v", err)
	}
	if err := k.SetStringValue("CustomKeep", "preserve-me"); err != nil {
		k.Close()
		t.Fatalf("set CustomKeep failed: %v", err)
	}
	k.Close()

	// 2. Update protocol to a missing executable path -> verify health transitions to missing & cleanable
	err = UpdateProtocol(ProtocolPayload{
		Name:        scheme,
		Scope:       ScopeHKCU,
		Description: "Updated Description",
		Command:     `"C:\__upm_nonexistent_dir__\ghost.exe" "%1"`,
		IconPath:    "",
	})
	if err != nil {
		t.Fatalf("UpdateProtocol failed: %v", err)
	}

	// Verify unrelated value is untouched
	kCheck, err := winreg.OpenKey(winreg.CURRENT_USER, hkcuClassesPath+`\`+scheme, winreg.QUERY_VALUE)
	if err != nil {
		t.Fatalf("reopen test key failed: %v", err)
	}
	keepVal, _, err := kCheck.GetStringValue("CustomKeep")
	kCheck.Close()
	if err != nil || keepVal != "preserve-me" {
		t.Fatalf("UpdateProtocol modified unrelated value: val=%q err=%v", keepVal, err)
	}

	items, _ = ScanAll()
	found = findByID(items, "HKCU:"+scheme)
	if found == nil || found.Description != "Updated Description" || found.Health != HealthMissing || !found.Cleanable {
		t.Fatalf("unexpected updated state: %+v", found)
	}

	// 3. Export to standard UTF-16LE .reg
	regBytes, err := ExportProtocolsToReg([]ProtocolRef{{Scope: ScopeHKCU, Name: scheme}})
	if err != nil {
		t.Fatalf("ExportProtocolsToReg failed: %v", err)
	}
	if len(regBytes) < 2 || regBytes[0] != 0xFF || regBytes[1] != 0xFE {
		t.Fatalf("exported .reg missing UTF-16LE BOM")
	}

	// 4. Safe Disable mode (only removes "URL Protocol", keeps subkeys intact)
	if err := DeleteProtocol(ScopeHKCU, scheme, DeleteModeDisable); err != nil {
		t.Fatalf("DeleteProtocol(disable) failed: %v", err)
	}
	if ProtocolExists(ScopeHKCU, scheme) {
		t.Fatalf("protocol should not be active after DeleteModeDisable")
	}
	// Subkey shell\open\command must still exist
	subKey, err := winreg.OpenKey(winreg.CURRENT_USER, hkcuClassesPath+`\`+scheme+`\shell\open\command`, winreg.QUERY_VALUE)
	if err != nil {
		t.Fatalf("expected shell\\open\\command to survive DeleteModeDisable, got err: %v", err)
	}
	subKey.Close()

	// 5. Full recursive delete -> verify entire tree including root is completely removed
	if err := DeleteProtocol(ScopeHKCU, scheme, DeleteModeFull); err != nil {
		t.Fatalf("DeleteProtocol(full) failed: %v", err)
	}
	if kLeft, err := winreg.OpenKey(winreg.CURRENT_USER, hkcuClassesPath+`\`+scheme, winreg.QUERY_VALUE); err == nil {
		kLeft.Close()
		t.Fatalf("expected root key to be completely deleted by DeleteModeFull")
	}

	// 6. Preview & Import from exported .reg -> restores protocol completely
	preview, err := PreviewRegImport("test.reg", regBytes, ScopeHKCU)
	if err != nil {
		t.Fatalf("PreviewRegImport failed: %v", err)
	}
	if len(preview.Items) != 1 || preview.Items[0].Name != scheme || preview.Items[0].Exists {
		t.Fatalf("unexpected import preview: %+v", preview)
	}
	applyRes, err := ApplyRegImport(regBytes, []string{preview.Items[0].ID}, ScopeHKCU)
	if err != nil || applyRes.Imported != 1 || applyRes.Failed != 0 {
		t.Fatalf("ApplyRegImport failed: res=%+v err=%v", applyRes, err)
	}
	if !ProtocolExists(ScopeHKCU, scheme) {
		t.Fatalf("protocol should exist after ApplyRegImport")
	}

	// 7. Test HKCR fallback & UTF-8 .reg parsing
	hkcrUTF8 := []byte("Windows Registry Editor Version 5.00\r\n\r\n" +
		"[HKEY_CLASSES_ROOT\\" + stale1 + "]\r\n" +
		"@=\"URL:HKCR Test\"\r\n" +
		"\"URL Protocol\"=\"\"\r\n\r\n" +
		"[HKEY_CLASSES_ROOT\\" + stale1 + "\\shell\\open\\command]\r\n" +
		"@=\"\\\"C:\\\\__missing__\\\\a.exe\\\" \\\"%1\\\"\"\r\n")
	hkcrPrev, err := PreviewRegImport("hkcr.reg", hkcrUTF8, ScopeHKCU)
	if err != nil || len(hkcrPrev.Items) != 1 || !hkcrPrev.Items[0].FromHKCR || hkcrPrev.Items[0].Scope != ScopeHKCU {
		t.Fatalf("unexpected HKCR preview: %+v err=%v", hkcrPrev, err)
	}
	if _, err := ApplyRegImport(hkcrUTF8, []string{hkcrPrev.Items[0].ID}, ScopeHKCU); err != nil {
		t.Fatalf("ApplyRegImport(HKCR) failed: %v", err)
	}

	// 8. Batch clean stale protocols
	if err := CreateProtocol(ProtocolPayload{
		Name:    stale2,
		Scope:   ScopeHKCU,
		Command: `"C:\__missing__\b.exe" "%1"`,
	}); err != nil {
		t.Fatalf("CreateProtocol(stale2) failed: %v", err)
	}

	cleanRes := BatchClean([]ProtocolRef{
		{Scope: ScopeHKCU, Name: stale1},
		{Scope: ScopeHKCU, Name: stale2},
	})
	if cleanRes.Succeeded != 2 || cleanRes.Failed != 0 {
		t.Fatalf("BatchClean unexpected result: %+v", cleanRes)
	}
	if ProtocolExists(ScopeHKCU, stale1) || ProtocolExists(ScopeHKCU, stale2) {
		t.Fatalf("stale protocols should be completely cleaned")
	}
}

func TestSecurityAndRegressionFixes(t *testing.T) {
	suffix := fmt.Sprintf("%d", time.Now().UnixNano()%1000000)
	progID := "upmprogid" + suffix
	expandScheme := "upmexpand" + suffix

	t.Cleanup(func() {
		_ = DeleteProtocol(ScopeHKCU, progID, DeleteModeFull)
		_ = DeleteProtocol(ScopeHKCU, expandScheme, DeleteModeFull)
	})

	// 1. CreateProtocol must refuse to overwrite an existing non-URL-protocol key (e.g. ProgID)
	k, _, err := winreg.CreateKey(winreg.CURRENT_USER, hkcuClassesPath+`\`+progID, winreg.SET_VALUE)
	if err != nil {
		t.Fatalf("setup non-protocol key failed: %v", err)
	}
	_ = k.SetStringValue("", "Original ProgID")
	k.Close()

	if err := CreateProtocol(ProtocolPayload{
		Name:    progID,
		Scope:   ScopeHKCU,
		Command: `"%SystemRoot%\System32\notepad.exe" "%1"`,
	}); err == nil {
		t.Fatalf("expected CreateProtocol to reject colliding non-protocol key %s", progID)
	}
	// Verify original key remained untouched
	kVerify, err := winreg.OpenKey(winreg.CURRENT_USER, hkcuClassesPath+`\`+progID, winreg.QUERY_VALUE)
	if err != nil {
		t.Fatalf("reopen progID failed: %v", err)
	}
	origDesc, _, _ := kVerify.GetStringValue("")
	_, _, markerErr := kVerify.GetValue("URL Protocol", nil)
	kVerify.Close()
	if origDesc != "Original ProgID" || markerErr == nil {
		t.Fatalf("existing ProgID was altered: desc=%q markerErr=%v", origDesc, markerErr)
	}

	// 2. Env var command must be stored as REG_EXPAND_SZ, preserved on update, and clearable when emptied
	if err := CreateProtocol(ProtocolPayload{
		Name:        expandScheme,
		Scope:       ScopeHKCU,
		Description: "URL:Expand Test",
		Command:     `"%SystemRoot%\System32\notepad.exe" "%1"`,
		IconPath:    `"%SystemRoot%\System32\notepad.exe",0`,
	}); err != nil {
		t.Fatalf("CreateProtocol(expandScheme) failed: %v", err)
	}

	cmdKey, err := winreg.OpenKey(winreg.CURRENT_USER, hkcuClassesPath+`\`+expandScheme+`\shell\open\command`, winreg.QUERY_VALUE)
	if err != nil {
		t.Fatalf("open command key failed: %v", err)
	}
	_, valType, err := cmdKey.GetValue("", nil)
	cmdKey.Close()
	if err != nil || valType != winreg.EXPAND_SZ {
		t.Fatalf("expected REG_EXPAND_SZ (%d), got type=%d err=%v", winreg.EXPAND_SZ, valType, err)
	}

	// 3. BatchClean must refuse to delete a healthy protocol (Cleanable == false)
	refused := BatchClean([]ProtocolRef{{Scope: ScopeHKCU, Name: expandScheme}})
	if refused.Succeeded != 0 || refused.Failed != 1 {
		t.Fatalf("expected BatchClean to reject healthy protocol, got %+v", refused)
	}
	if !ProtocolExists(ScopeHKCU, expandScheme) {
		t.Fatalf("healthy protocol should not have been deleted by BatchClean")
	}

	// 4. Export & preview hex(2) DefaultIcon, and verify ApplyRegImport rejects empty selection
	regBytes, err := ExportProtocolsToReg([]ProtocolRef{{Scope: ScopeHKCU, Name: expandScheme}})
	if err != nil {
		t.Fatalf("ExportProtocolsToReg failed: %v", err)
	}
	prev, err := PreviewRegImport("expand.reg", regBytes, ScopeHKCU)
	if err != nil || len(prev.Items) != 1 || !strings.Contains(prev.Items[0].IconPath, "notepad.exe") {
		t.Fatalf("expected preview to decode hex(2) DefaultIcon, got %+v err=%v", prev, err)
	}
	if _, err := ApplyRegImport(regBytes, []string{}, ScopeHKCU); err == nil {
		t.Fatalf("expected ApplyRegImport with empty selectedIDs to fail")
	}

	// 5. Clearing command via UpdateProtocol actually removes the command default value
	if err := UpdateProtocol(ProtocolPayload{
		Name:        expandScheme,
		Scope:       ScopeHKCU,
		Description: "URL:Expand Test",
		Command:     "",
		IconPath:    "",
	}); err != nil {
		t.Fatalf("UpdateProtocol(clear command) failed: %v", err)
	}
	items, _ := ScanAll()
	got := findByID(items, "HKCU:"+expandScheme)
	if got == nil || got.Command != "" || got.Health != HealthEmpty {
		t.Fatalf("expected cleared command with health=empty, got %+v", got)
	}
}

func findByID(items []ProtocolItem, id string) *ProtocolItem {
	for i := range items {
		if strings.EqualFold(items[i].ID, id) {
			return &items[i]
		}
	}
	return nil
}
