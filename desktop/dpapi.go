package main

import (
	"encoding/base64"
	"syscall"
	"unsafe"
)

// Windows DPAPI 数据结构
type dataBlob struct {
	cbData uint32
	pbData *byte
}

var (
	crypt32                = syscall.NewLazyDLL("crypt32.dll")
	kernel32               = syscall.NewLazyDLL("kernel32.dll")
	procCryptProtectData   = crypt32.NewProc("CryptProtectData")
	procCryptUnprotectData = crypt32.NewProc("CryptUnprotectData")
	procLocalFree          = kernel32.NewProc("LocalFree")
)

// encryptPassword 使用 Windows DPAPI 加密密码
// 加密后的数据只能由当前 Windows 用户在当前机器上解密
func encryptPassword(plaintext string) (string, error) {
	if plaintext == "" {
		return "", nil
	}
	bytes := []byte(plaintext)
	if len(bytes) == 0 {
		return "", nil
	}

	var inBlob dataBlob
	inBlob.cbData = uint32(len(bytes))
	inBlob.pbData = &bytes[0]

	var outBlob dataBlob
	ret, _, err := procCryptProtectData.Call(
		uintptr(unsafe.Pointer(&inBlob)),
		0, // description (optional)
		0, // reserved
		0, // key (optional, use user credentials)
		0, // prompt (optional)
		0, // flags
		uintptr(unsafe.Pointer(&outBlob)),
	)
	if ret == 0 {
		return "", err
	}
	defer procLocalFree.Call(uintptr(unsafe.Pointer(outBlob.pbData)))

	result := make([]byte, outBlob.cbData)
	copy(result, (*[1 << 30]byte)(unsafe.Pointer(outBlob.pbData))[:outBlob.cbData])
	return base64.StdEncoding.EncodeToString(result), nil
}

// decryptPassword 使用 Windows DPAPI 解密密码
func decryptPassword(ciphertext string) (string, error) {
	if ciphertext == "" {
		return "", nil
	}
	bytes, err := base64.StdEncoding.DecodeString(ciphertext)
	if err != nil {
		return "", err
	}
	if len(bytes) == 0 {
		return "", nil
	}

	var inBlob dataBlob
	inBlob.cbData = uint32(len(bytes))
	inBlob.pbData = &bytes[0]

	var outBlob dataBlob
	ret, _, err := procCryptUnprotectData.Call(
		uintptr(unsafe.Pointer(&inBlob)),
		0, // description (optional)
		0, // reserved
		0, // key
		0, // prompt
		0, // flags
		uintptr(unsafe.Pointer(&outBlob)),
	)
	if ret == 0 {
		return "", err
	}
	defer procLocalFree.Call(uintptr(unsafe.Pointer(outBlob.pbData)))

	result := make([]byte, outBlob.cbData)
	copy(result, (*[1 << 30]byte)(unsafe.Pointer(outBlob.pbData))[:outBlob.cbData])
	return string(result), nil
}
