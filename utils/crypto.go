package utils

import (
	"bytes"
	"crypto/aes"
	"encoding/base64"
)

// EncryptPassword encrypts the password using AES-128-ECB with double base64 encoding.
// This matches the encryption used by BUPT's JWGL WeChat API (jwglweixin.bupt.edu.cn).
func EncryptPassword(pwd string) string {
	key := []byte("qzkj1kjghd=876&*")
	// Wrap password in double quotes before encryption
	data := []byte(`"` + pwd + `"`)

	// PKCS7 padding
	blockSize := aes.BlockSize
	padding := blockSize - len(data)%blockSize
	padText := bytes.Repeat([]byte{byte(padding)}, padding)
	data = append(data, padText...)

	// AES-128-ECB encrypt
	block, err := aes.NewCipher(key)
	if err != nil {
		panic(err)
	}
	encrypted := make([]byte, len(data))
	for i := 0; i < len(data); i += blockSize {
		block.Encrypt(encrypted[i:i+blockSize], data[i:i+blockSize])
	}

	// Double base64 encode
	first := base64.StdEncoding.EncodeToString(encrypted)
	return base64.StdEncoding.EncodeToString([]byte(first))
}
