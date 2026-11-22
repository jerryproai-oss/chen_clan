/**
 * Auth layout — 置中，無導覽列。
 * 用於 /login 等認證頁面
 */
export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <>{children}</>;
}
