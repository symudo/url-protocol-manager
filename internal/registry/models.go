package registry

// Scope indicates which Windows registry hive owns the protocol definition.
type Scope string

const (
	ScopeHKCU Scope = "HKCU"
	ScopeHKLM Scope = "HKLM"
)

// HealthStatus summarizes the target executable availability of a protocol.
type HealthStatus string

const (
	HealthOK      HealthStatus = "ok"
	HealthMissing HealthStatus = "missing"
	HealthSystem  HealthStatus = "system"
	HealthEmpty   HealthStatus = "empty"
)

// DeleteMode selects between full recursive deletion and safe disabling.
type DeleteMode string

const (
	DeleteModeFull    DeleteMode = "full"
	DeleteModeDisable DeleteMode = "disable"
)

// ProtocolItem represents a registered custom URL protocol in HKCU or HKLM.
type ProtocolItem struct {
	ID                  string       `json:"id"`
	Name                string       `json:"name"`
	Scope               Scope        `json:"scope"`
	RegistryPath        string       `json:"registryPath"`
	Description         string       `json:"description"`
	Command             string       `json:"command"`
	ExecutablePath      string       `json:"executablePath"`
	ExecutableName      string       `json:"executableName"`
	IconPath            string       `json:"iconPath"`
	IconData            string       `json:"iconData"`
	Health              HealthStatus `json:"health"`
	HealthNote          string       `json:"healthNote"`
	IsUWP               bool         `json:"isUwp"`
	IsComposite         bool         `json:"isComposite"`
	CompositeKeys       []string     `json:"compositeKeys"`
	IsShadowed          bool         `json:"isShadowed"`
	ShadowsSystem       bool         `json:"shadowsSystem"`
	HasSameInOtherScope bool         `json:"hasSameInOtherScope"`
	Cleanable           bool         `json:"cleanable"`
}

// ProtocolPayload is used for creating or updating a protocol.
type ProtocolPayload struct {
	Name        string `json:"name"`
	Scope       Scope  `json:"scope"`
	Description string `json:"description"`
	Command     string `json:"command"`
	IconPath    string `json:"iconPath"`
}

// ProtocolRef identifies a protocol by scope and name.
type ProtocolRef struct {
	Scope Scope  `json:"scope"`
	Name  string `json:"name"`
}

// BatchCleanItemResult holds the outcome for a single item in batch cleaning.
type BatchCleanItemResult struct {
	Scope   Scope  `json:"scope"`
	Name    string `json:"name"`
	Success bool   `json:"success"`
	Error   string `json:"error,omitempty"`
}

// BatchCleanResult summarizes a batch clean execution.
type BatchCleanResult struct {
	Succeeded int                    `json:"succeeded"`
	Failed    int                    `json:"failed"`
	Items     []BatchCleanItemResult `json:"items"`
}

// ImportPreviewItem summarizes one protocol detected inside a .reg file.
type ImportPreviewItem struct {
	ID           string `json:"id"`
	Name         string `json:"name"`
	Scope        Scope  `json:"scope"`
	FromHKCR     bool   `json:"fromHkcr"`
	Description  string `json:"description"`
	Command      string `json:"command"`
	IconPath     string `json:"iconPath"`
	Exists       bool   `json:"exists"`
	NeedsAdmin   bool   `json:"needsAdmin"`
	SectionCount int    `json:"sectionCount"`
}

// ImportPreviewResult contains parsed protocols from a .reg file for user review.
type ImportPreviewResult struct {
	FilePath      string              `json:"filePath"`
	Items         []ImportPreviewItem `json:"items"`
	SkippedKeys   int                 `json:"skippedKeys"`
	RequiresAdmin bool                `json:"requiresAdmin"`
}

// ImportApplyResult summarizes importing selected protocols from a .reg file.
type ImportApplyResult struct {
	Imported int      `json:"imported"`
	Failed   int      `json:"failed"`
	Errors   []string `json:"errors"`
}
