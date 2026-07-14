// ============================================
// 导航栏链接预设配置
// ============================================
// 这个文件定义了导航栏中使用的预设链接。
// 每个链接包含：名称、URL、图标。
// 在 navBarConfig.ts 中可以引用这些预设。
// ============================================

import I18nKey from "@i18n/i18nKey";
import { i18n } from "@i18n/translation";
import { LinkPreset, type NavBarLink } from "@/types/config";

export const LinkPresets: { [key in LinkPreset]: NavBarLink } = {
	// 首页
	[LinkPreset.Home]: {
		name: i18n(I18nKey.home),
		url: "/",
		icon: "material-symbols:home",
	},
	// 关于页
	[LinkPreset.About]: {
		name: i18n(I18nKey.about),
		url: "/about/",
		icon: "material-symbols:person",
	},
	// 归档页
	[LinkPreset.Archive]: {
		name: i18n(I18nKey.archive),
		url: "/archive/",
		icon: "material-symbols:archive",
	},
	// 友链页
	[LinkPreset.Friends]: {
		name: i18n(I18nKey.friends),
		url: "/friends/",
		icon: "material-symbols:group",
	},
	// 赞助页
	[LinkPreset.Sponsor]: {
		name: i18n(I18nKey.sponsor),
		url: "/sponsor/",
		icon: "material-symbols:favorite",
	},
	// 留言板
	[LinkPreset.Guestbook]: {
		name: i18n(I18nKey.guestbook),
		url: "/guestbook/",
		icon: "material-symbols:chat",
	},
	// 番组计划
	[LinkPreset.Bangumi]: {
		name: i18n(I18nKey.bangumi),
		url: "/bangumi/",
		icon: "material-symbols:movie",
	},
	// 相册页
	[LinkPreset.Gallery]: {
		name: i18n(I18nKey.gallery),
		url: "/gallery/",
		icon: "material-symbols:photo-library",
	},
	// 标签页
	[LinkPreset.Tags]: {
		name: i18n(I18nKey.tags),
		url: "/tags/",
		icon: "material-symbols:tag-rounded",
	},
	// 分类页
	[LinkPreset.Categories]: {
		name: i18n(I18nKey.categories),
		url: "/categories/",
		icon: "material-symbols:folder-open-rounded",
	},
	// 转载页（新增）
	[LinkPreset.Republish]: {
		name: i18n(I18nKey.republish),      // 显示名称，使用多语言
		url: "/republish/",                  // 页面路径
		icon: "material-symbols:repeat",    // 图标
	},
};
