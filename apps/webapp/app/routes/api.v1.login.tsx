import { json } from "~/lib/remix-compat";
import { z } from "zod";
import { createHybridActionApiRoute } from "~/services/routeBuilders/apiBuilder.server";
import { prisma } from "~/db.server";

// 简单用户名密码登录
const LoginSchema = z.object({
  username: z.string().min(1, "用户名不能为空"),
  password: z.string().min(1, "密码不能为空"),
});

const { action } = createHybridActionApiRoute({
  body: LoginSchema,
  allowJWT: false,
  corsStrategy: "all",
}, async ({ body }) => {
  const { username, password } = body;
  
  // 硬编码的用户名密码（个人系统，简单处理）
  const USERS = {
    "admin": "admin123",
    "user": "user123",
  };
  
  if (!USERS[username] || USERS[username] !== password) {
    return json({ error: "用户名或密码错误" }, { status: 401 });
  }
  
  // 创建会话
  const session = {
    id: Math.random().toString(36).substring(7),
    username,
    name: username === "admin" ? "管理员" : "用户",
    email: `${username}@local`,
    createdAt: new Date().toISOString(),
  };
  
  return json({
    id: session.id,
    username: session.username,
    name: session.name,
    email: session.email,
    token: session.id,
  });
});

export { action };
