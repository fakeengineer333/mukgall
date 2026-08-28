import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "마이페이지",
};

export default function MyPage() {
  redirect("/?view=mypage");
}
