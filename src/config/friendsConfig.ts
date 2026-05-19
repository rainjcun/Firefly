import type { FriendLink, FriendsPageConfig } from "../types/config";

// 可以在src/content/spec/friends.md中编写友链页面下方的自定义内容

// 友链页面配置
export const friendsPageConfig: FriendsPageConfig = {
	title: "",
	description: "",
	showCustomContent: true,
	showComment: true,
	randomizeSort: false,
};

// 友链配置
export const friendsConfig: FriendLink[] = [
	{
		title: "番茄主理人",
		imgurl: "https://q1.qlogo.cn/g?b=qq&nk=20447289&s=640",
		desc: "坐而言不如起而行.",
		siteurl: "https://fqzlr.com/",
		tags: ["Blog"],
		weight: 10,
		enabled: true,
		issue_id: 0,
	},
	{
		title: "椰汁の主页",
		imgurl: "https://free.picui.cn/free/2026/03/23/69c12fe83f7a4.jpg",
		desc: "关关难过关关过,前路漫漫亦灿灿.",
		siteurl: "https://home.132614.xyz/",
		tags: ["Blog"],
		weight: 10,
		enabled: true,
		issue_id: 0,
	},
	{
		title: "UpXuu",
		imgurl: "https://upxuu.com/images/20260214145619.jpg",
		desc: "逐光而上！",
		siteurl: "https://upxuu.com",
		tags: ["Blog"],
		weight: 10,
		enabled: true,
		issue_id: 0,
	},
	{
		title: "Re.Y.Ju.hao | 个人主页",
		imgurl: "https://img.cdn1.vip/i/69f03a1c79908_1777351196.webp",
		desc: "先活着吧，其他的再想想",
		siteurl: "http://irehao.42web.io/",
		tags: ["Blog"],
		weight: 10,
		enabled: true,
		issue_id: 22,
	},
	{
		title: "大熊",
		imgurl: "https://halo.aizaibao.cn/upload/%E5%A4%B4%E5%83%8F.jpg",
		desc: "日常随笔与灵感收集小角落",
		siteurl: "https://halo.aizaibao.cn/",
		tags: ["Blog"],
		weight: 10,
		enabled: true,
		issue_id: 23,
	},
	{
		title: "年华",
		imgurl: "https://q1.qlogo.cn/g?b=qq&nk=1323860289&s=640",
		desc: "分享生活和记术。",
		siteurl: "https://love-firefly.ccwu.cc/",
		tags: ["Blog"],
		weight: 10,
		enabled: true,
		issue_id: 26,
	},
	{
		title: "xf_blog",
		imgurl:
			"https://github.com/lm-xiao-fen/lm-xiao-fen.github.io/blob/main/image/MEITU_20260128_220225596.jpg?raw=true",
		desc: "立志用 cloudflare workers，GitHub pages 和 vercel 做出整个互联网的up（虽然不会成功",
		siteurl: "https://lm-xiao-fen.github.io/",
		tags: ["Blog"],
		weight: 10,
		enabled: true,
		issue_id: 28,
	},
	{
		title: "MmzMing",
		imgurl: "https://i.stardots.io/784774835/StarDots-2026051117505284739.webp",
		desc: "神人博客",
		siteurl: "https://tblog.mmzhiku.xyz/",
		tags: ["Blog"],
		weight: 10,
		enabled: true,
		issue_id: 40,
	},
	{
		title: "年华",
		imgurl: "https://q1.qlogo.cn/g?b=qq&nk=1323860289&s=640",
		desc: "分享生活和技术。",
		siteurl: "https://blog.520781.xyz/",
		tags: ["Blog"],
		weight: 10,
		enabled: true,
		issue_id: 26,
	},
];

// 获取启用的友链并进行排序
export const getEnabledFriends = (): FriendLink[] => {
	const friends = friendsConfig.filter((friend) => friend.enabled);

	if (friendsPageConfig.randomizeSort) {
		return friends.sort(() => Math.random() - 0.5);
	}

	return friends.sort((a, b) => b.weight - a.weight);
};
