"use client";

import { useTranslation } from "@/lib/i18n";

const vi = {
  tab: "Quảng cáo",
  title: "Quảng cáo màn hình khách hàng",
  hint: "Playlist riêng của cửa hàng, đồng bộ realtime với JPOS.",
  upload: "Thêm hình ảnh hoặc video",
  uploadHint: "PNG, JPG, WEBP hoặc MP4; video tối đa 15 giây; tối đa 10 mục.",
  uploading: "Đang tải lên…",
  save: "Lưu playlist",
  saving: "Đang lưu…",
  saved: "Đã đồng bộ playlist quảng cáo tới JPOS.",
  empty: "Chưa có quảng cáo. Màn hình khách hàng sẽ dùng ảnh mặc định.",
  enabled: "Hiển thị",
  duration: "Thời lượng ảnh",
  seconds: "giây",
  remove: "Xóa",
  removeConfirm: "Xóa tệp này khỏi playlist quảng cáo?",
  image: "Hình ảnh",
  video: "Video",
  version: "Phiên bản",
  realtime: "Realtime",
  limit: "Playlist đã đủ 10 mục.",
  invalid: "Tệp không hợp lệ. Chỉ nhận PNG, JPG, WEBP hoặc MP4 tối đa 15 giây.",
};

const zh: typeof vi = {
  tab: "广告",
  title: "顾客屏广告",
  hint: "每家门店独立播放列表，与 JPOS 实时同步。",
  upload: "添加图片或视频",
  uploadHint: "PNG、JPG、WEBP 或 MP4；视频最长 15 秒；最多 10 项。",
  uploading: "上传中…",
  save: "保存播放列表",
  saving: "保存中…",
  saved: "广告播放列表已同步到 JPOS。",
  empty: "暂无广告，顾客屏将显示默认图片。",
  enabled: "显示",
  duration: "图片时长",
  seconds: "秒",
  remove: "删除",
  removeConfirm: "从广告播放列表中删除此文件？",
  image: "图片",
  video: "视频",
  version: "版本",
  realtime: "实时",
  limit: "播放列表已达到 10 项上限。",
  invalid: "文件无效。仅支持 PNG、JPG、WEBP 或最长 15 秒的 MP4。",
};

export function usePosAdvertisingCopy() {
  const { lang } = useTranslation();
  return lang === "zh" ? zh : vi;
}
