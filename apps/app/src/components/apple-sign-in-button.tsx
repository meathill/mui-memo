import { api } from '@/lib/api';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Platform, View } from 'react-native';

/**
 * iOS 原生 Sign in with Apple 按钮。用 Expo 封装过的系统组件（高亮 / 跟系统
 * 主题走 / 圆角样式系统负责），只在支持的设备上渲染。
 *
 * 流程：
 *  1. 本地生成 nonce（明文）→ sha256 后交给 Apple 做 `nonce` 参数
 *  2. 拿回 identityToken 给后端；后端拿明文 nonce 与 JWT 里的 nonce hash 对
 *  3. Better-Auth 验签通过后返回 session token，和邮箱登录同路径
 */
export function AppleSignInButton() {
  const [available, setAvailable] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    AppleAuthentication.isAvailableAsync()
      .then(setAvailable)
      .catch(() => setAvailable(false));
  }, []);

  if (!available) return null;

  async function handlePress() {
    if (busy) return;
    setBusy(true);
    try {
      const rawNonce = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });
      if (!credential.identityToken) {
        Alert.alert('Apple 登录失败', '没拿到 identityToken');
        return;
      }
      await api.auth.signInWithApple({
        identityToken: credential.identityToken,
        nonce: rawNonce,
        fullName: credential.fullName,
      });
      router.replace('/today');
    } catch (err) {
      // 用户取消（code='ERR_REQUEST_CANCELED'）不提示
      const code = (err as { code?: string } | null)?.code;
      if (code === 'ERR_REQUEST_CANCELED') return;
      Alert.alert('Apple 登录失败', err instanceof Error ? err.message : '未知错误');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ opacity: busy ? 0.6 : 1 }}>
      <AppleAuthentication.AppleAuthenticationButton
        buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
        buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
        cornerRadius={8}
        style={{ width: '100%', height: 48 }}
        onPress={handlePress}
      />
    </View>
  );
}
