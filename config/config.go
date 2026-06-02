package config

import (
	"EmptyClassroom/logs"
	"context"
	"encoding/json"
	"io"
	"os"
)

const (
	ConfigPathKey = "CONFIG_PATH"
)

type CampusConfig struct {
	Name         string `json:"name"`
	Id           int    `json:"id,omitempty"`
	HasRealtime  bool   `json:"has_realtime"`
	ReplaceRegex []struct {
		Regex   string `json:"regex"`
		Replace string `json:"replace"`
	} `json:"replace_regex"`
}

type NotificationConfig struct {
	Title            string `json:"title"`
	Content          string `json:"content"`
	Duration         int    `json:"duration"`
	Type             string `json:"type"`
	ShowNotification bool   `json:"showNotification"`
	Start            string `json:"start"`
	End              string `json:"end"`
}

type Config struct {
	Campus       []CampusConfig     `json:"campus"`
	Notification NotificationConfig `json:"notification"`
}

var GlobalConfig *Config

func InitConfig() {
	configPath := os.Getenv(ConfigPathKey)
	if configPath == "" {
		configPath = "config"
	}
	_, err := os.Stat(configPath + "/config.json")
	if err != nil {
		logs.CtxError(context.Background(), "stat config file failed: %v", err)
		panic(err)
	}
	configFile, err := os.Open(configPath + "/config.json")
	if err != nil {
		logs.CtxError(context.Background(), "open config file failed: %v", err)
		panic(err)
	}
	configContent, err := io.ReadAll(configFile)
	if err != nil {
		logs.CtxError(context.Background(), "read config file failed: %v", err)
		panic(err)
	}
	GlobalConfig = new(Config)
	err = json.Unmarshal(configContent, &GlobalConfig)
	if err != nil {
		logs.CtxError(context.Background(), "unmarshal config file failed: %v", err)
		panic(err)
	}

	// Read notification config
	_, err = os.Stat(configPath + "/notification.json")
	if err != nil {
		logs.CtxError(context.Background(), "stat notification file failed: %v", err)
		panic(err)
	}
	configFile, err = os.Open(configPath + "/notification.json")
	if err != nil {
		logs.CtxError(context.Background(), "open notification file failed: %v", err)
		panic(err)
	}
	configContent, err = io.ReadAll(configFile)
	if err != nil {
		logs.CtxError(context.Background(), "read notification file failed: %v", err)
		panic(err)
	}
	notificationConfig := new(NotificationConfig)
	err = json.Unmarshal(configContent, &notificationConfig)
	if err != nil {
		logs.CtxError(context.Background(), "unmarshal notification file failed: %v", err)
		panic(err)
	}
	GlobalConfig.Notification = *notificationConfig
}

func GetConfig() Config {
	if GlobalConfig == nil {
		InitConfig()
	}
	return *GlobalConfig
}
