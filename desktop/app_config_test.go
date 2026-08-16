package main

import (
	"os"
	"path/filepath"
	"testing"
)

// 新路径已存在时优先新路径：旧配置不得覆盖新配置
func TestMigrateLegacyConfig_NewPathWins(t *testing.T) {
	dir := t.TempDir()
	newPath := filepath.Join(dir, "new", "config.json")
	oldPath := filepath.Join(dir, "old", "config.json")
	if err := os.MkdirAll(filepath.Dir(newPath), 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(filepath.Dir(oldPath), 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(newPath, []byte(`{"appName":"NEW"}`), 0644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(oldPath, []byte(`{"appName":"OLD"}`), 0644); err != nil {
		t.Fatal(err)
	}

	if err := migrateLegacyConfig(newPath, oldPath); err != nil {
		t.Fatalf("新路径存在时不应报错: %v", err)
	}
	data, _ := os.ReadFile(newPath)
	if string(data) != `{"appName":"NEW"}` {
		t.Fatalf("新路径配置被旧配置覆盖: %s", data)
	}
}

// 旧路径迁移：新路径不存在且旧路径存在时，复制到新路径
func TestMigrateLegacyConfig_MigratesOld(t *testing.T) {
	dir := t.TempDir()
	newPath := filepath.Join(dir, "new", "config.json")
	oldPath := filepath.Join(dir, "old", "config.json")
	if err := os.MkdirAll(filepath.Dir(newPath), 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(filepath.Dir(oldPath), 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(oldPath, []byte(`{"appName":"OLD"}`), 0644); err != nil {
		t.Fatal(err)
	}

	if err := migrateLegacyConfig(newPath, oldPath); err != nil {
		t.Fatalf("应完成迁移: %v", err)
	}
	data, _ := os.ReadFile(newPath)
	if string(data) != `{"appName":"OLD"}` {
		t.Fatalf("新路径应为旧配置内容: %s", data)
	}
}

// 首次运行：两边都不存在，不报错也不创建文件
func TestMigrateLegacyConfig_FirstRun(t *testing.T) {
	dir := t.TempDir()
	newPath := filepath.Join(dir, "new", "config.json")
	oldPath := filepath.Join(dir, "old", "config.json")
	if err := os.MkdirAll(filepath.Dir(newPath), 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(filepath.Dir(oldPath), 0755); err != nil {
		t.Fatal(err)
	}

	if err := migrateLegacyConfig(newPath, oldPath); err != nil {
		t.Fatalf("首次运行不应报错: %v", err)
	}
	if _, err := os.Stat(newPath); !os.IsNotExist(err) {
		t.Fatal("首次运行不应创建新配置文件")
	}
}

// GetStartupWarnings 返回副本，外部修改不影响内部状态
func TestGetStartupWarnings_ReturnsCopy(t *testing.T) {
	a := &App{}
	a.warnStartup("警告一")
	a.warnStartup("警告二")
	got := a.GetStartupWarnings()
	if len(got) != 2 || got[0] != "警告一" || got[1] != "警告二" {
		t.Fatalf("警告内容不符: %v", got)
	}
	got[0] = "篡改"
	if a.GetStartupWarnings()[0] != "警告一" {
		t.Fatal("返回应为副本，外部修改不应影响内部状态")
	}
}
