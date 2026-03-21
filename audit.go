package main

import (
	"crypto/x509"
	"encoding/json"
	"encoding/pem"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"time"
)

// AuditEntry represents a single connect/disconnect event
type AuditEntry struct {
	ID          string `json:"id"`
	ProfileName string `json:"profileName"`
	ConnectedAt string `json:"connectedAt"`
	Duration    string `json:"duration"`
	VpnIP       string `json:"vpnIp"`
	ServerIP    string `json:"serverIp"`
}

// CertInfo holds parsed certificate details
type CertInfo struct {
	Subject   string `json:"subject"`
	Issuer    string `json:"issuer"`
	ExpiresAt string `json:"expiresAt"`
	DaysLeft  int    `json:"daysLeft"`
	IsExpired bool   `json:"isExpired"`
	IsWarning bool   `json:"isWarning"` // true if expiring within 30 days
}

func auditLogPath() string {
	return filepath.Join(configDir(), "audit.json")
}

// LoadAuditLog returns all audit entries, newest first
func (a *App) LoadAuditLog() ([]AuditEntry, error) {
	data, err := os.ReadFile(auditLogPath())
	if err != nil {
		if os.IsNotExist(err) {
			return []AuditEntry{}, nil
		}
		return nil, err
	}
	var entries []AuditEntry
	if err := json.Unmarshal(data, &entries); err != nil {
		return nil, err
	}
	return entries, nil
}

func (a *App) appendAuditEntry(entry AuditEntry) {
	entries, _ := a.LoadAuditLog()
	// Prepend so newest is first
	entries = append([]AuditEntry{entry}, entries...)
	// Keep last 100 entries
	if len(entries) > 100 {
		entries = entries[:100]
	}
	data, _ := json.MarshalIndent(entries, "", "  ")
	os.MkdirAll(configDir(), 0700)
	os.WriteFile(auditLogPath(), data, 0600)
}

// ClearAuditLog wipes the audit log
func (a *App) ClearAuditLog() error {
	return os.Remove(auditLogPath())
}

// DeleteAuditEntry removes a single entry by ID
func (a *App) DeleteAuditEntry(id string) error {
	entries, err := a.LoadAuditLog()
	if err != nil {
		return err
	}
	filtered := entries[:0]
	for _, e := range entries {
		if e.ID != id {
			filtered = append(filtered, e)
		}
	}
	if len(filtered) == 0 {
		return os.Remove(auditLogPath())
	}
	data, _ := json.MarshalIndent(filtered, "", "  ")
	os.MkdirAll(configDir(), 0700)
	return os.WriteFile(auditLogPath(), data, 0600)
}

// GetCertInfo parses the certificate from an ovpn file and returns expiry info
func (a *App) GetCertInfo(ovpnPath string) (*CertInfo, error) {
	data, err := os.ReadFile(ovpnPath)
	if err != nil {
		return nil, err
	}

	// Extract <cert>...</cert> block
	certRe := regexp.MustCompile(`(?s)<cert>(.*?)</cert>`)
	match := certRe.FindSubmatch(data)
	if match == nil {
		// Try inline cert= directive
		return nil, fmt.Errorf("no certificate found in config")
	}

	pemData := match[1]
	block, _ := pem.Decode(pemData)
	if block == nil {
		return nil, fmt.Errorf("failed to decode PEM certificate")
	}

	cert, err := x509.ParseCertificate(block.Bytes)
	if err != nil {
		return nil, fmt.Errorf("failed to parse certificate: %w", err)
	}

	daysLeft := int(time.Until(cert.NotAfter).Hours() / 24)

	return &CertInfo{
		Subject:   cert.Subject.CommonName,
		Issuer:    cert.Issuer.CommonName,
		ExpiresAt: cert.NotAfter.Format("2 Jan 2006"),
		DaysLeft:  daysLeft,
		IsExpired: daysLeft < 0,
		IsWarning: daysLeft >= 0 && daysLeft <= 30,
	}, nil
}

// CheckProfileCerts returns cert info for all profiles that have a cert
func (a *App) CheckProfileCerts() (map[string]*CertInfo, error) {
	profiles, err := a.LoadProfiles()
	if err != nil {
		return nil, err
	}
	result := make(map[string]*CertInfo)
	for _, p := range profiles {
		info, err := a.GetCertInfo(p.OvpnPath)
		if err != nil {
			continue // no cert in this profile, skip
		}
		result[p.ID] = info
	}
	return result, nil
}
