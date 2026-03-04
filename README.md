![](https://github.com/thecodingmachine/workadventure/workflows/Continuous%20Integration/badge.svg) [![Discord](https://img.shields.io/discord/821338762134290432?label=Discord)](https://discord.gg/G6Xh9ZM9aR) ![Awesome](https://awesome.re/badge.svg)

![WorkAdventure office image](README-MAP.png)

# WorkAdventure


WorkAdventure is a platform that allows you to design **fully customizable collaborative virtual worlds** (metaverse). 

With your own avatar, you can **interact spontaneously** with your colleagues, clients, partners (using a **video-chat system**, triggered when you approach someone).
Imagine **all types of immersive experiences** (recruitments, onboarding, trainings, digital workplace, internal/external events) on desktop, mobile or tablet.

_The little plus? The platform is **GDPR** and **open source**!_

**See more features for your [virtual office](https://workadventu.re/virtual-offices/virtual-meetings/?utm_source=github)!**

**Pricing for our [SaaS version](https://workadventu.re/pricing/?utm_source=github)!**


[![Workadventure live demo example](https://workadventu.re/wp-content/uploads/2024/02/Button-Live-Demo.png)](https://play.staging.workadventu.re/@/tcm/workadventure/wa-village/?utm_source=github)
[![Workadventure Website](https://workadventu.re/wp-content/uploads/2024/02/Button-Website.png)](https://workadventu.re/?utm_source=github)


###### Support our team!
[![Discord Logo](https://workadventu.re/wp-content/uploads/2024/02/Icon-Discord.png)](https://discord.com/invite/G6Xh9ZM9aR)
[![X Social Logo](https://workadventu.re/wp-content/uploads/2024/02/Icon-X.png)](https://twitter.com/Workadventure_)
[![LinkedIn Logo](https://workadventu.re/wp-content/uploads/2024/02/Icon-LinkedIn.png)](https://www.linkedin.com/company/workadventu-re/)


![Stats repo](https://github-readme-stats.vercel.app/api?username={username}&theme=transparent)



## Community resources

1. Want to build your own map, check out our **[map building documentation](https://docs.workadventu.re/map-building/)**
2. Check out resources developed by the WorkAdventure community at **[awesome-workadventure](https://github.com/workadventure/awesome-workadventure)**

## Setting up a production environment

We support 2 ways to set up a production environment:

- using Docker Compose
- or using a Helm chart for Kubernetes

Please check the [Setting up a production environment](docs/others/self-hosting/install.md) guide for more information.

> [!NOTE]
> WorkAdventure also provides a [hosted version](https://workadventu.re/?utm_source=github) of the application. Using the hosted version is
> the easiest way to get started and helps us to keep the project alive.

## Setting up a development environment

> [!NOTE]
> These installation instructions are for local development only. They will not work on
> remote servers as local environments do not have HTTPS certificates.

Install Docker and clone this repository.

> [!WARNING]
> If you are using Windows, make sure the End-Of-Line character is not modified by the cloning process by setting
> the `core.autocrlf` setting to false: `git config --global core.autocrlf false`

Run:

```
cp .env.template .env
docker-compose up
```

The environment will start with the OIDC mock server enabled by default.

You should now be able to browse to http://play.workadventure.localhost/ and see the application.
You can view the Traefik dashboard at http://traefik.workadventure.localhost

(Test user is "User1" and password is "pwd")

If you want to disable the OIDC mock server (for anonymous access), you can run:

```console
$ docker-compose -f docker-compose.yaml -f docker-compose-no-oidc.yaml up
```

Note: on some OSes, you will need to add this line to your `/etc/hosts` file:

**/etc/hosts**
```
127.0.0.1 oidc.workadventure.localhost redis.workadventure.localhost play.workadventure.localhost traefik.workadventure.localhost matrix.workadventure.localhost extra.workadventure.localhost icon.workadventure.localhost map-storage.workadventure.localhost uploader.workadventure.localhost maps.workadventure.localhost api.workadventure.localhost front.workadventure.localhost
```


### Troubleshooting

See our [troubleshooting guide](docs/others/troubleshooting.md).

#### Proto 文件生成问题

如果在启动时遇到 `protoc` 命令崩溃（SIGSEGV）的问题，这是因为 `grpc-tools` 包中的 protoc 二进制文件可能与当前系统架构不兼容。

**解决方案**: 手动安装系统级 `protobuf-compiler` 并生成 proto 文件：

```bash
# 在 messages 容器中安装 protobuf-compiler
docker exec -u root worldje-messages-1 apt-get update && apt-get install -y protobuf-compiler

# 生成 proto 文件
docker exec worldje-messages-1 bash -c "cd /usr/src/app && protoc --experimental_allow_proto3_optional --plugin=./node_modules/.bin/protoc-gen-ts_proto --ts_proto_out=../libs/messages/src/ts-proto-generated --ts_proto_opt=outputServices=grpc-js --ts_proto_opt=oneof=unions --ts_proto_opt=esModuleInterop=true -I ./protos protos/*.proto"

# 添加 ts-nocheck 注释
docker exec worldje-messages-1 bash -c "cd /usr/src/app && sed -i '1i\//@ts-nocheck' ../libs/messages/src/ts-proto-generated/*.ts"
```

生成完成后，重启相关服务：
```bash
docker-compose restart play back map-storage
``` 
