<template>
  <div class="login-container">
    <div class="login-card">
      <div class="login-header">
        <div class="login-badge">MN</div>
        <h1>MemoryNote</h1>
        <p>个人知识沉淀系统</p>
      </div>
      
      <form @submit.prevent="handleLogin" class="login-form">
        <div class="form-group">
          <label>用户名</label>
          <input 
            v-model="username" 
            type="text" 
            placeholder="请输入用户名"
            required
            autocomplete="username"
            autofocus
            class="text-input"
          />
        </div>
        <div class="form-group">
          <label>访问密码</label>
          <input 
            v-model="password" 
            type="password" 
            placeholder="输入密码"
            required
            autocomplete="current-password"
            class="password-input"
          />
        </div>
        
        <p v-if="error" class="error-msg">{{ error }}</p>
        
        <button type="submit" :disabled="isLoading" class="login-btn">
          {{ isLoading ? "登录中..." : "进入" }}
        </button>
      </form>
      
        <p class="login-hint-text">默认密码：<code>8888</code></p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";

const router = useRouter();
const username = ref("");
const password = ref("");
const error = ref("");
const isLoading = ref(false);

async function handleLogin() {
  isLoading.value = true;
  error.value = "";
  
  try {
    // 简单密码验证（个人系统）
    if (password.value === "8888") {
      const uname = username.value.trim() || "用户";
      localStorage.setItem("user_token", "local");
      localStorage.setItem("user_name", uname);
      localStorage.setItem("user_email", `${uname.toLowerCase()}@local`);
      localStorage.setItem("user_password", password.value);
      router.push("/home");
    } else {
      error.value = "密码错误";
    }
  } catch (e) {
    error.value = "登录失败";
  } finally {
    isLoading.value = false;
  }
}
</script>

<style scoped>
.login-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
  padding: 20px;
}

.login-card {
  background: rgba(255, 255, 255, 0.95);
  border-radius: 20px;
  padding: 48px 40px;
  width: 100%;
  max-width: 380px;
  box-shadow: 0 25px 80px rgba(0,0,0,0.4);
  backdrop-filter: blur(10px);
}

.login-header {
  text-align: center;
  margin-bottom: 36px;
}

.login-badge {
  width: 72px;
  height: 72px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 20px;
  color: white;
  font-weight: bold;
  font-size: 24px;
  box-shadow: 0 10px 30px rgba(102, 126, 234, 0.4);
}

.login-header h1 {
  margin: 0 0 8px;
  font-size: 32px;
  color: #1a1a2e;
  font-weight: 700;
}

.login-header p {
  margin: 0;
  color: #666;
  font-size: 14px;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-group label {
  font-size: 14px;
  font-weight: 600;
  color: #333;
  letter-spacing: 0.5px;
}

.password-input {
  padding: 16px 20px;
  border: 2px solid #e0e0e0;
  border-radius: 12px;
  font-size: 18px;
  letter-spacing: 4px;
  transition: all 0.2s;
  text-align: center;
}

.password-input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 4px rgba(102, 126, 234, 0.1);
}

.text-input {
  padding: 14px 20px;
  border: 2px solid #e0e0e0;
  border-radius: 12px;
  font-size: 16px;
  transition: all 0.2s;
  text-align: left;
}

.text-input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 4px rgba(102, 126, 234, 0.1);
}

.error-msg {
  color: #e74c3c;
  font-size: 14px;
  text-align: center;
  margin: 0;
  padding: 8px;
  background: #fdf0f0;
  border-radius: 8px;
}

.login-btn {
  padding: 16px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 12px;
  font-size: 18px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 8px 24px rgba(102, 126, 234, 0.3);
}

.login-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 12px 32px rgba(102, 126, 234, 0.4);
}

.login-btn:active:not(:disabled) {
  transform: translateY(0);
}

.login-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.login-hint {
  margin-top: 24px;
}

.login-hint-text {
  margin: 0;
  font-size: 13px;
  color: #666;
  text-align: center;
}
</style>
