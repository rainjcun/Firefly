import type { SponsorConfig } from "../types/config";

export const sponsorConfig: SponsorConfig = {
	title: "",
	description: "",
	usage: "",
	methods: [
		{
			name: "支付宝",
			icon: "fa7-brands:alipay",
			qrCode: "/assets/images/sponsor/alipay.png",
			link: "",
			description: "使用 支付宝 扫码赞助",
			enabled: true,
		},
		{
			name: "微信",
			icon: "fa7-brands:weixin",
			qrCode: "/assets/images/sponsor/wechat.png",
			link: "",
			description: "使用 微信 扫码赞助",
			enabled: true,
		},
		{
			name: "爱发电",
			icon: "simple-icons:afdian",
			qrCode: "",
			link: "https://ifdian.net/a/fqzlr",
			description: "通过 爱发电 进行赞助",
			enabled: true,
		},
	],
	sponsors: [
		{
			name: "214556787",
			amount: "￥1",
			date: "2025-10-01",
		},
	],
	showSponsorsList: true,
	showComment: true,
	showButtonInPost: true,
};
