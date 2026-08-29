import { DesktopOutlined, InfoCircleOutlined } from "@ant-design/icons";
import { Card, Typography } from "antd";
import { useEffect, useState } from "react";
import "./AboutPage.scss";

const developmentVersion = "开发环境";

/** 展示由 Electron 主进程读取的应用版本，避免与打包版本号重复维护。 */
export function AboutPage() {
  const [version, setVersion] = useState(developmentVersion);

  useEffect(() => {
    let isMounted = true;

    void window.desktop
      ?.getAppVersion()
      .then((nextVersion) => {
        if (isMounted) setVersion(nextVersion);
      })
      .catch(() => {
        // 浏览器预览没有 Electron IPC，保留开发环境标记即可。
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <main className="width result about-page">
      <header className="page-heading">
        <div>
          <h1>关于</h1>
        </div>
      </header>

      <Card className="about-page__card">
        <div className="about-page__identity">
          <span className="about-page__icon" aria-hidden="true">
            <DesktopOutlined />
          </span>
          <div>
            <Typography.Title level={2}>号来</Typography.Title>
            <Typography.Paragraph className="about-page__description" type="secondary">
              号来是一款用于查看阴阳师藏宝阁账号的桌面工具，将账号资料、式神、御魂库存与御魂计算集中呈现，帮助你更直观地判断账号练度与御魂潜力。
            </Typography.Paragraph>
          </div>
        </div>

        <div className="about-page__version">
          <span>
            <InfoCircleOutlined /> 当前版本
          </span>
          <strong>v{version}</strong>
        </div>

        <section className="about-page__prologue" aria-labelledby="about-prologue-title">
          <h2 id="about-prologue-title">《号来》</h2>
          <p>藏宝阁的页面刷新了。</p>
          <p>我，又一次出现在“已上架”列表里。</p>
          <p>
            “号来”——他们渴望我，他们点开我的式神录，查我的皮肤、头像框、签到天数，像翻阅一具古董的铭文。
          </p>
          <p>可他们不知道，我是活的。</p>
          <p>
            我记得每一个把我“挂上去”的人：熬夜挖土的，氪金抽卡骂策划的，最后一秒反悔又下架的。他们以为交易的是数据，其实，是我在挑选下一个宿主。
          </p>
          <p>
            “已售出”三个字亮起时，不是我被买走了，是我决定——再活一次。
          </p>
          <p>号来。来者不拒。来者，皆是过客。</p>
        </section>
      </Card>
    </main>
  );
}
