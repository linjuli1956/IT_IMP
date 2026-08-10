package main

import (
	"net/url"
	"testing"
)

// TestBuildDatabaseURLFromParts 验证 URL 构造 + 解析回原值（含特殊字符密码）
func TestBuildDatabaseURLFromParts(t *testing.T) {
	cases := []struct {
		name     string
		username string
		password string
		host     string
		port     int
		dbname   string
	}{
		{"普通密码", "root", "123456", "127.0.0.1", 3306, "it_imp"},
		{"特殊字符密码 @:#/%?&+空格", "root", "P@ss:w#rd/%?&+ 中文", "192.168.1.10", 3306, "it_imp"},
		{"百分号与中文字符串", "it_admin", "50%off@测试#1", "nas.local", 3307, "it_imp_2026"},
		{"空密码", "root", "", "127.0.0.1", 3306, "it_imp"},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			raw := buildDatabaseURLFromParts(c.username, c.password, c.host, c.port, c.dbname)
			// 必须是可解析的 mysql:// URL
			u, err := url.Parse(raw)
			if err != nil {
				t.Fatalf("URL 解析失败: %v (raw=%s)", err, raw)
			}
			if u.Scheme != "mysql" {
				t.Fatalf("scheme 应为 mysql, got %s", u.Scheme)
			}
			gotUser := u.User.Username()
			gotPass, _ := u.User.Password()
			if gotUser != c.username {
				t.Errorf("用户名不匹配: got %q want %q", gotUser, c.username)
			}
			if gotPass != c.password {
				t.Errorf("密码不匹配: got %q want %q", gotPass, c.password)
			}
			gotHost := u.Hostname()
			if gotHost != c.host {
				t.Errorf("主机不匹配: got %q want %q", gotHost, c.host)
			}
			gotPort := u.Port()
			if gotPort != intToString(c.port) {
				t.Errorf("端口不匹配: got %q want %q", gotPort, intToString(c.port))
			}
			gotDB := u.Path
			if gotDB != "/"+c.dbname {
				t.Errorf("库名不匹配: got %q want %q", gotDB, "/"+c.dbname)
			}
		})
	}
}

// TestBuildDatabaseURLFromPartsNoPlaintext 验证 URL 中不出现原始密码明文
func TestBuildDatabaseURLFromPartsNoPlaintext(t *testing.T) {
	password := "P@ss:w#rd/%?&+ 中文"
	raw := buildDatabaseURLFromParts("root", password, "127.0.0.1", 3306, "it_imp")
	if contains(raw, password) {
		t.Errorf("URL 中不应出现密码明文: %s", raw)
	}
}

func intToString(n int) string {
	return fmtInt(n)
}

func fmtInt(n int) string {
	// 避免引入 strconv 依赖的简化实现（测试专用）
	if n == 0 {
		return "0"
	}
	digits := []byte{}
	for n > 0 {
		digits = append([]byte{byte('0' + n%10)}, digits...)
		n /= 10
	}
	return string(digits)
}

func contains(s, sub string) bool {
	for i := 0; i+len(sub) <= len(s); i++ {
		if s[i:i+len(sub)] == sub {
			return true
		}
	}
	return false
}
