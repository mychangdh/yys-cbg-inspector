import { InfoCircleOutlined } from "@ant-design/icons";
import { Button, Modal } from "antd";
import { useState } from "react";
import styles from "./index.module.scss";

export function CalculatorMethodInfo() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className={styles.scope}>
        <div className="calculator-method-info-trigger">
          <Button
            type="link"
            icon={<InfoCircleOutlined />}
            onClick={() => setOpen(true)}
          >
            计算器是怎么计算的？
          </Button>
        </div>
      </div>
      <Modal
        open={open}
        rootClassName={`${styles.scope} calculator-page-modal`}
        className="calculator-method-modal"
        title="计算说明"
        width={560}
        destroyOnHidden
        footer={
          <Button type="primary" onClick={() => setOpen(false)}>
            知道了
          </Button>
        }
        onCancel={() => setOpen(false)}
      >
        <div className="calculator-method-info">
          <section className="calculator-method-block">
            <h3>先按条件筛选</h3>
            <p>
              会先根据你选的号位、主属性、指定御魂和套装条件排除不符合的御魂。没有符合条件的御魂时，结果自然会变少，或者没有结果。
            </p>
            <p className="calculator-method-highlight">
              不会只按攻击、爆伤或速度其中一项，先挑出一小批御魂再拿来凑组合。不同属性方向的候选都会一起参与判断，补速度、补暴击或补爆伤的御魂不会因为单件分数不高就被当成无用御魂。
            </p>
          </section>

          <section className="calculator-method-block">
            <h3>再计算最终面板</h3>
            <p>
              每套组合都会计入式神基础面板、六件御魂的主属性和副属性，以及满足条件后的两件套、四件套和逢魔套属性。
            </p>
            <p>
              速度、暴击、攻击、爆伤、效果命中等范围也会在这一步检查。只有全部条件都满足的组合，才会按你选择的指标参与排序。
            </p>
            <p className="calculator-method-highlight">
              展示出来的每一条结果都会用这套真实六件御魂重新计算最终面板、套装效果和全部限制条件。数值不是估算，也不是把不同御魂的属性拼出来的假结果。
            </p>
          </section>

          <section className="calculator-method-block">
            <h3>按六个位置找组合</h3>
            <p>
              计算时会先把御魂按 1 到 6
              号位分成六组数组。页面展示用的是完整御魂信息；进入计算后，会转换成只保留御魂
              ID、套装和本次计算需要属性的数组。比如算伤害时会重点看攻击、攻击加成、暴击和爆伤；有速度条件时才额外带上速度。
            </p>
            <p>
              这一步叫数组化和属性向量化：搜索组合时，不再反复搬运图标、强化记录等展示信息，而是从六个位置各取一件，把需要的属性值直接相加。套装属性不会重复写到每一件御魂里，而是在凑齐两件、四件或逢魔套后统一计入面板。这样同一套装规则可以复用，也能减少重复计算。
            </p>
          </section>

          <section className="calculator-method-block">
            <h3>哪些组合会提前跳过</h3>
            <p className="calculator-method-highlight">
              计算不会一开始就把所有六件套全部展开，但也不会为了图快随便砍掉路线。每选一件御魂，都会把剩余号位按最有利的属性情况再算一遍：例如还差很多速度，而剩下几个位置就算都取最高速度也达不到要求，这条路线才会提前跳过。
            </p>
            <p>
              这个理论上限只用来判断“这条路线还有没有可能达标”，不参与最终计分。真正计算结果时，仍然使用同一组具体的六件御魂相加，不会把不同御魂的局部最高属性拼成一套不存在的面板。
            </p>
          </section>

          <section className="calculator-method-block">
            <h3>为什么条件多时会慢一点</h3>
            <p>
              御魂数量多，又同时要求套装、速度、满暴、攻击和爆伤时，可选组合会很多。计算器会保留不同属性方向的候选，避免为了快而把后面可能达标的组合提前删掉。
            </p>
          </section>

          <section className="calculator-method-block">
            <h3>普通计算和极速计算</h3>
            <p>
              普通计算会保留你设置数量的靠前结果，适合想比较多套方案时使用。
            </p>
            <p>
              极速计算只显示第一名，少做其他结果的整理和排序，所以会更快。它仍然按同一套面板、套装和条件规则计算；加速的重点是少做无效路线和其他名次的整理，不是把可能成为第一名的真实御魂组合换成估算结果。
            </p>
          </section>
        </div>
      </Modal>
    </>
  );
}
