package main

import (
	"strings"
	"testing"
)

// netstat 解析：仅取目标端口 LISTENING 行，IPv4/IPv6 去重，
// 相近端口（前缀匹配）、ESTABLISHED、UDP、PID 0 均不得误报
func TestParseNetstatListeningPIDs(t *testing.T) {
	out := strings.Join([]string{
		"  TCP    0.0.0.0:3999           0.0.0.0:0              LISTENING       1234",
		"  TCP    [::]:3999              [::]:0                 LISTENING       1234",
		"  TCP    0.0.0.0:39990          0.0.0.0:0              LISTENING       5678", // 端口前缀相近，不得误报
		"  TCP    192.168.1.10:3999      192.168.1.5:51000      ESTABLISHED     4321", // 非监听态
		"  UDP    0.0.0.0:3999           *:*                                    9999",  // UDP 行无 LISTENING
		"  TCP    0.0.0.0:4000           0.0.0.0:0              LISTENING       0",    // PID 0 忽略
	}, "\n")
	pids := parseNetstatListeningPIDs(out, 3999)
	if len(pids) != 1 || pids[0] != "1234" {
		t.Fatalf("应仅解析出 IPv4/IPv6 去重后的 1234，实际: %v", pids)
	}
	if got := parseNetstatListeningPIDs(out, 5000); len(got) != 0 {
		t.Fatalf("无人监听的端口应返回空，实际: %v", got)
	}
}

// 端口无人占用：纯"服务已停止"
func TestStopOutcomeMessage_CleanStop(t *testing.T) {
	if got := stopOutcomeMessage(3999, nil, ""); got != "服务已停止" {
		t.Fatalf("干净停止消息不符: %q", got)
	}
	if got := stopOutcomeMessage(3999, nil, "Web服务进程已自行退出"); got != "Web服务进程已自行退出，服务已停止" {
		t.Fatalf("自退干净停止消息不符: %q", got)
	}
}

// 端口被未知进程占用：必须明示"未自动结束"，且携带端口与 PID
func TestStopOutcomeMessage_PortStillOccupied(t *testing.T) {
	got := stopOutcomeMessage(3999, []string{"7777"}, "")
	if !strings.Contains(got, "未自动结束") {
		t.Fatalf("占用消息必须包含\"未自动结束\": %q", got)
	}
	if !strings.Contains(got, "7777") || !strings.Contains(got, "3999") {
		t.Fatalf("占用消息应包含端口与 PID: %q", got)
	}
	got2 := stopOutcomeMessage(3999, []string{"7777", "8888"}, "Web服务进程已自行退出")
	if !strings.Contains(got2, "Web服务进程已自行退出") || !strings.Contains(got2, "未自动结束") || !strings.Contains(got2, "8888") {
		t.Fatalf("自退+多 PID 占用组合消息不符: %q", got2)
	}
}

// 双重终止失败：不得误报"已停止"，必须明示状态未知并保持运行语义
func TestDecideStopFailure_NotReportingStopped(t *testing.T) {
	got := decideStopFailure("拒绝访问", "Access is denied")
	if strings.Contains(got, "服务已停止") {
		t.Fatalf("停止失败消息不得包含\"服务已停止\": %q", got)
	}
	if !strings.HasPrefix(got, "停止失败") {
		t.Fatalf("停止失败消息应以\"停止失败\"开头（前端据此判定不置 serviceRunning=false）: %q", got)
	}
	if !strings.Contains(got, "状态未知") {
		t.Fatalf("停止失败消息应明示状态未知: %q", got)
	}
	if !strings.Contains(got, "拒绝访问") || !strings.Contains(got, "Access is denied") {
		t.Fatalf("停止失败消息应携带两级终止的错误详情: %q", got)
	}
}
