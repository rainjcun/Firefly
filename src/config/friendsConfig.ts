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
	},
	{
		title: "椰汁の主页",
		imgurl: "https://free.picui.cn/free/2026/03/23/23/69c12fe83f7a4.jpg",
		desc: "关关难过关关过，前路漫漫亦灿灿。",
		siteurl: "https://home.132614.xyz/",
		tags: ["Blog"],
		weight: 10,
		enabled: true,
	},
	{
		title: "UpXuu's blog",
		imgurl: "https://upxuu.com/images/20260214145619.jpg",
		desc: "逐光而上！",
		siteurl: "https://upxuu.com",
		tags: ["Blog"],
		weight: 10,
		enabled: true,
	},

	// ↓↓ 自动化友链写入位置 ↓↓
];

// 获取启用的友链并进行排序
export const getEnabledFriends = (): FriendLink[] => {
	const friends = friendsConfig.filter((friend) => friend.enabled);

	if (friendsPageConfig.randomizeSort) {
		return friends.toSorted(() => Math.random() - 0.5);
	}

	return friends.toSorted((a, b) => b.weight - a.weight);
};