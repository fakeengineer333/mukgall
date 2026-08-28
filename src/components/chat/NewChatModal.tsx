"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MessageSquarePlus, Search, Users, User, Check, Loader2, X, AlertCircle } from "lucide-react";
import { Profile } from "@/types";
import { searchUsersAction, createChatRoomAction } from "@/app/actions/chat";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

export function NewChatModal() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isGroup, setIsGroup] = useState(false);
  const [roomName, setRoomName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<Profile[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    const users = await searchUsersAction(query);
    setSearchResults(users);
    setSearching(false);
  };

  const toggleSelectUser = (user: Profile) => {
    if (!isGroup) {
      // 1:1 chat mode: select only 1 user
      setSelectedUsers([user]);
    } else {
      // Group mode: toggle selection
      if (selectedUsers.some((u) => u.id === user.id)) {
        setSelectedUsers(selectedUsers.filter((u) => u.id !== user.id));
      } else {
        setSelectedUsers([...selectedUsers, user]);
      }
    }
  };

  const handleStartSelfChat = () => {
    setError(null);
    startTransition(async () => {
      const res = await createChatRoomAction({
        isGroup: false,
        targetUserIds: [],
      });

      if (res.error) {
        setError(res.error);
      } else if (res.roomId) {
        setIsOpen(false);
        router.push(`/chat/${res.roomId}`);
      }
    });
  };

  const handleCreateRoom = () => {
    if (selectedUsers.length === 0) {
      setError("대화할 유저를 선택해주세요.");
      return;
    }

    setError(null);
    startTransition(async () => {
      const res = await createChatRoomAction({
        isGroup,
        targetUserIds: selectedUsers.map((u) => u.id),
        name: roomName,
      });

      if (res.error) {
        setError(res.error);
      } else if (res.roomId) {
        setIsOpen(false);
        router.push(`/chat/${res.roomId}`);
      }
    });
  };

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        size="sm"
        className="gap-1.5 font-bold shadow-md shadow-blue-600/30"
      >
        <MessageSquarePlus className="h-4 w-4" />
        새 대화 시작
      </Button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-md rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-2xl space-y-4">
            {/* Close button */}
            <button
              onClick={() => setIsOpen(false)}
              className="absolute right-4 top-4 rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer"
              disabled={isPending}
            >
              <X className="h-5 w-5" />
            </button>

            <div>
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white">새로운 대화 시작</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                1:1 대화, 나와의 채팅, 또는 단체 대화방을 만들 수 있습니다.
              </p>
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Mode Switch: 1:1 vs Group */}
            <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => {
                  setIsGroup(false);
                  if (selectedUsers.length > 1) setSelectedUsers(selectedUsers.slice(0, 1));
                }}
                className={`flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  !isGroup ? "bg-blue-600 text-white shadow" : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                }`}
              >
                <User className="h-3.5 w-3.5" />
                1:1 대화
              </button>
              <button
                type="button"
                onClick={() => setIsGroup(true)}
                className={`flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  isGroup ? "bg-blue-600 text-white shadow" : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                }`}
              >
                <Users className="h-3.5 w-3.5" />
                그룹 단체방
              </button>
            </div>

            {/* Quick Self Chat Button for 1:1 Mode */}
            {!isGroup && (
              <button
                type="button"
                onClick={handleStartSelfChat}
                disabled={isPending}
                className="w-full flex items-center justify-between p-3 rounded-xl border border-blue-200 dark:border-blue-800/80 bg-blue-50/80 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 transition-colors shadow-xs group cursor-pointer text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white font-bold text-xs shadow-md shadow-blue-600/30">
                    나
                  </div>
                  <div>
                    <span className="text-xs font-bold text-zinc-900 dark:text-white">나와의 채팅</span>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      나만의 메모와 사진을 기록하고 보관할 수 있습니다
                    </p>
                  </div>
                </div>
                <span className="text-xs font-bold text-blue-600 dark:text-blue-400 group-hover:translate-x-0.5 transition-transform">
                  시작 →
                </span>
              </button>
            )}

            {/* Group Room Name (if group) */}
            {isGroup && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  대화방 이름 (선택)
                </label>
                <Input
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  placeholder="예: 묵갤 사진 동호회"
                  maxLength={50}
                  disabled={isPending}
                />
              </div>
            )}

            {/* Selected Users Chips */}
            {selectedUsers.length > 0 && (
              <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto py-1">
                {selectedUsers.map((u) => (
                  <span
                    key={u.id}
                    className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 dark:bg-blue-600/20 border border-blue-200 dark:border-blue-500/40 px-2.5 py-1 text-xs text-blue-700 dark:text-blue-300"
                  >
                    <Avatar src={u.avatar_url} fallbackText={u.username} size="sm" className="h-4 w-4" />
                    <span>{u.username}</span>
                    <button
                      type="button"
                      onClick={() => setSelectedUsers(selectedUsers.filter((x) => x.id !== u.id))}
                      className="hover:text-blue-900 dark:hover:text-white"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* User Search Input */}
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
                <Input
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder="다른 유저 닉네임으로 검색..."
                  className="pl-9 text-xs bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100"
                  disabled={isPending}
                />
              </div>

              {/* Search Results List */}
              <div className="max-h-48 overflow-y-auto rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/60 divide-y divide-zinc-200 dark:divide-zinc-800/60">
                {searching ? (
                  <div className="flex items-center justify-center py-6 text-zinc-500 text-xs gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    검색 중...
                  </div>
                ) : searchResults.length === 0 ? (
                  <p className="py-6 text-center text-xs text-zinc-500">
                    {searchQuery ? "검색된 유저가 없습니다." : "대화 상대를 검색해주세요."}
                  </p>
                ) : (
                  searchResults.map((u) => {
                    const isSelected = selectedUsers.some((sel) => sel.id === u.id);
                    return (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => toggleSelectUser(u)}
                        className={`flex w-full items-center justify-between p-3 text-left transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800/60 ${
                          isSelected ? "bg-blue-50 dark:bg-blue-950/30" : ""
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <Avatar src={u.avatar_url} fallbackText={u.username} size="sm" />
                          <div>
                            <div className="flex items-center gap-1">
                              <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-200">
                                {u.username}
                              </span>
                              {u.role === "ADMIN" && (
                                <Badge variant="admin" className="text-[9px] px-1 py-0">
                                  관리자
                                </Badge>
                              )}
                            </div>
                            {u.bio && (
                              <p className="text-[10px] text-zinc-500 line-clamp-1">{u.bio}</p>
                            )}
                          </div>
                        </div>

                        {isSelected && (
                          <div className="h-5 w-5 rounded-full bg-blue-600 text-white flex items-center justify-center">
                            <Check className="h-3 w-3" />
                          </div>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="secondary"
                className="flex-1"
                onClick={() => setIsOpen(false)}
                disabled={isPending}
              >
                취소
              </Button>
              <Button
                type="button"
                className="flex-1 gap-1.5 font-bold"
                onClick={handleCreateRoom}
                disabled={isPending || selectedUsers.length === 0}
              >
                {isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    생성 중...
                  </>
                ) : (
                  "대화 시작"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
