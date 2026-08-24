import { redirect } from "next/navigation";

export default function ChatListPage() {
  redirect("/?view=chat");
}
