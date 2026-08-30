import { json } from "~/lib/remix-compat";
import { createHybridLoaderApiRoute } from "~/services/routeBuilders/apiBuilder.server";

// 获取当前用户信息
const { loader } = createHybridLoaderApiRoute({
  allowJWT: false,
  corsStrategy: "all",
}, async ({ headers }) => {
  // 简单检查 token（实际应该用 session 或 JWT）
  const token = headers.get("Authorization")?.replace("Bearer ", "");
  
  if (!token) {
    return json({ user: null });
  }
  
  // 验证 token（这里简单验证，实际应该查数据库）
  const validTokens = ["admin", "user"];
  if (validTokens.includes(token)) {
    return json({ 
      user: { 
        id: token, 
        username: token, 
        name: token === "admin" ? "管理员" : "用户", 
        email: `${token}@local` 
      } 
    });
  }
  
  return json({ user: null });
});

export { loader };
