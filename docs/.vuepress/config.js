module.exports = {
  title: "g1f9",
  description: "记录",
  themeConfig: {
    // displayAllHeaders: true,
    // sidebar: {
    //   // "/frontend/": ["read-code/"],
    //   "/frontend/read-code/": [
    //     "snabbdom",
    //     "vue-route",
    //     "vuex",
    //     "wepy",
    //     "axios",
    //     "vue",
    //     "tapable"
    //   ],
    //   "/frontend/advanced/": ["performance", "mobile"],
    //   "/frontend/basics/": ["network-protocol"]
    // },
    sidebar: "auto",
    nav: [
      {
        text: "首页",
        link: "/"
      },
      {
        text: "前端",
        items: [
          {
            text: "资源收集",
            link: "/frontend/resource"
          },
          {
            text: "基础阅读",
            link: "/frontend/basics/"
          },
          {
            text: "源码阅读",
            link: "/frontend/read-code/"
          },
          {
            text: "扩展阅读",
            link: "/frontend/advanced/"
          }
        ]
      }
    ]
  }
};
