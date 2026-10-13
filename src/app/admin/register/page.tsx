import { redirect } from "next/navigation";

// 公开的 /admin/register 已关闭：防止任意访客注册成店员（越权）。
// 捐赠人请走 /account/register；店员账号仅由店长在「设置 → 成员管理」中创建。
export default function AdminRegisterPage() {
  redirect("/account/register");
}
