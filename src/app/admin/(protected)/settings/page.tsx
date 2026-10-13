import { getStoreName } from "@/lib/settings";
import { listMembers } from "@/lib/members";
import { listCategoryTree } from "@/lib/category";
import { requireUser, isOwner } from "@/lib/session";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import AccountSecurity from "./account-security";
import MemberManager from "./member-manager";
import CategoryManager from "./category-manager";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [storeName, user, members, tree] = await Promise.all([
    getStoreName(),
    requireUser(),
    listMembers(),
    listCategoryTree(),
  ]);
  const owner = isOwner(user.roles);

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">店铺设置</CardTitle>
          <CardDescription>店名：{storeName}。公开账本、AI 通道等在后续版本配置。</CardDescription>
        </CardHeader>
      </Card>

      <AccountSecurity />

      {owner && (
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">成员管理</CardTitle>
            <CardDescription>新增店员账号、重置密码、禁用/启用、删除账号（仅店长可见）。</CardDescription>
          </CardHeader>
          <CardContent>
            <MemberManager members={members} currentUserId={user.id} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">分类管理</CardTitle>
          <CardDescription>管理大分类与其下的小分类。大分类需先删完小分类，分类下有物品时无法删除。</CardDescription>
        </CardHeader>
        <CardContent>
          <CategoryManager tree={tree} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">标签打印（锐浪报表）</CardTitle>
          <CardDescription>
            标签打印统一使用锐浪报表（Grid++Report）模板：把设计好的 <code className="bg-muted px-1">.grf</code>{" "}
            放入 <code className="bg-muted px-1">public/grf</code>，运行{" "}
            <code className="bg-muted px-1">npm run grf:manifest</code> 刷新清单后，
            打码台/货架即可选择该模板打印（直连 / 预览 / HTML5 预览）。物品名称在模板中已设为自动换行显示。
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}