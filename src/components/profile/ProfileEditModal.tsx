"use client";

import { useState, useActionState, useEffect } from "react";
import { Camera, Edit3, Loader2, AlertCircle, CheckCircle2, X } from "lucide-react";
import { Profile } from "@/types";
import { updateProfileAction, ProfileState } from "@/app/actions/profile";
import { checkUsernameAvailabilityAction } from "@/app/actions/auth";
import { uploadImageToStorage } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar } from "@/components/ui/avatar";

interface ProfileEditModalProps {
  profile: Profile;
}

export function ProfileEditModal({ profile }: ProfileEditModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [username, setUsername] = useState(profile.username);
  const [bio, setBio] = useState(profile.bio || "");
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url || "");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Username duplication check state
  const [usernameCheck, setUsernameCheck] = useState<{
    available: boolean;
    message: string;
  } | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setUsername(profile.username);
      setBio(profile.bio || "");
      setAvatarUrl(profile.avatar_url || "");
      setAvatarPreview(null);
      setUsernameCheck(null);
    }
  }, [isOpen, profile]);

  const handleCheckUsername = async (valueToCheck?: string) => {
    const val = (valueToCheck !== undefined ? valueToCheck : username).trim();
    if (!val) {
      setUsernameCheck({ available: false, message: "닉네임을 입력해주세요." });
      return;
    }
    if (val === profile.username) {
      setUsernameCheck(null);
      return;
    }
    setCheckingUsername(true);
    try {
      const res = await checkUsernameAvailabilityAction(val, profile.id);
      setUsernameCheck(res);
    } catch {
      setUsernameCheck({ available: false, message: "중복 확인 중 오류가 발생했습니다." });
    } finally {
      setCheckingUsername(false);
    }
  };

  const initialState: ProfileState = { error: null, success: false };
  const [state, formAction, isPending] = useActionState(async (prev: ProfileState, formData: FormData) => {
    const res = await updateProfileAction(prev, formData);
    if (res.success) {
      setTimeout(() => setIsOpen(false), 800);
    }
    return res;
  }, initialState);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const previewUrl = URL.createObjectURL(file);
    setAvatarPreview(previewUrl);

    setUploadingAvatar(true);
    const fileName = `${profile.id}/avatar-${Date.now()}-${file.name}`;
    const { url, error } = await uploadImageToStorage("avatars", fileName, file);
    setUploadingAvatar(false);

    if (error) {
      console.warn("Avatar storage upload note:", error);
    } else if (url) {
      setAvatarUrl(url);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5 border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white hover:bg-zinc-200 dark:hover:bg-zinc-700 font-medium shadow-sm"
        onClick={() => setIsOpen(true)}
      >
        <Edit3 className="h-3.5 w-3.5 text-zinc-700 dark:text-white shrink-0" />
        <span>프로필 수정</span>
      </Button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-md rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-2xl">
            {/* Close button */}
            <button
              onClick={() => setIsOpen(false)}
              className="absolute right-4 top-4 rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white transition-colors"
              disabled={isPending}
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-1">프로필 수정</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-5">
              닉네임, 한 줄 소개 및 프로필 사진을 변경할 수 있습니다.
            </p>

            {state?.error && (
              <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{state.error}</span>
              </div>
            )}

            {state?.success && (
              <div className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-400">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>프로필이 성공적으로 변경되었습니다!</span>
              </div>
            )}

            <form action={formAction} className="space-y-4">
              <input type="hidden" name="avatar_url" value={avatarUrl} />

              {/* Avatar Selector */}
              <div className="flex flex-col items-center justify-center space-y-2">
                <div className="relative group cursor-pointer">
                  <Avatar
                    src={avatarPreview || avatarUrl}
                    fallbackText={username || "User"}
                    size="xl"
                    className="border-2 border-zinc-300 dark:border-zinc-700"
                  />
                  <label
                    htmlFor="edit-avatar-upload"
                    className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-white"
                  >
                    {uploadingAvatar ? (
                      <Loader2 className="h-6 w-6 animate-spin" />
                    ) : (
                      <Camera className="h-6 w-6" />
                    )}
                  </label>
                  <input
                    id="edit-avatar-upload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarChange}
                    disabled={isPending || uploadingAvatar}
                  />
                </div>
                <label
                  htmlFor="edit-avatar-upload"
                  className="text-xs text-blue-600 dark:text-blue-400 cursor-pointer hover:underline"
                >
                  {uploadingAvatar ? "업로드 중..." : "사진 변경"}
                </label>
              </div>

              {/* Username Input */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="edit-username"
                    className="text-xs font-semibold text-zinc-700 dark:text-zinc-300"
                  >
                    닉네임
                  </label>
                  {checkingUsername && (
                    <span className="flex items-center gap-1 text-[11px] text-zinc-400">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      중복 확인 중...
                    </span>
                  )}
                </div>
                <Input
                  id="edit-username"
                  name="username"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    if (usernameCheck) setUsernameCheck(null);
                  }}
                  onBlur={() => handleCheckUsername()}
                  required
                  disabled={isPending}
                  className={
                    usernameCheck
                      ? usernameCheck.available
                        ? "border-emerald-500/50 focus-visible:ring-emerald-500/20"
                        : "border-red-500/50 focus-visible:ring-red-500/20"
                      : ""
                  }
                />
                {usernameCheck && (
                  <p
                    className={`flex items-center gap-1 text-[11px] font-medium pt-0.5 ${
                      usernameCheck.available
                        ? "text-emerald-500 dark:text-emerald-400"
                        : "text-red-500 dark:text-red-400"
                    }`}
                  >
                    {usernameCheck.available ? (
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                    ) : (
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    )}
                    <span>{usernameCheck.message}</span>
                  </p>
                )}
              </div>

              {/* Bio Input */}
              <div className="space-y-1.5">
                <label
                  htmlFor="edit-bio"
                  className="text-xs font-semibold text-zinc-700 dark:text-zinc-300"
                >
                  한 줄 소개
                </label>
                <Input
                  id="edit-bio"
                  name="bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="자신을 소개해주세요."
                  maxLength={200}
                  disabled={isPending}
                />
              </div>

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
                  type="submit"
                  className="flex-1 gap-2 font-bold"
                  disabled={
                    isPending ||
                    uploadingAvatar ||
                    checkingUsername ||
                    username.trim().length < 2 ||
                    (usernameCheck !== null && !usernameCheck.available)
                  }
                >
                  {isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      저장 중...
                    </>
                  ) : (
                    "저장하기"
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
