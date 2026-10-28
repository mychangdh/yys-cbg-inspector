(() => {
  const criteria = JSON.parse(__CRITERIA_JSON__);
  const normalize = (value) =>
    String(value ?? "")
      .replace(/\s+/g, "")
      .trim();
  const visible = (element) => {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return (
      rect.width > 0 &&
      rect.height > 0 &&
      style.display !== "none" &&
      style.visibility !== "hidden"
    );
  };
  const pageText = normalize(document.body?.innerText);

  if (
    /login|passport|account\/login/i.test(location.pathname) ||
    /扫码登录|手机号登录/.test(pageText)
  ) {
    return { status: "login_required" };
  }
  if (/安全验证|滑动验证|访问异常|风险控制|captcha/i.test(pageText)) {
    return { status: "security_check" };
  }

  const isRoleFilter =
    location.pathname.includes("/cgi/mweb/advance/search") &&
    new URLSearchParams(location.search).get("search_type") === "role";
  if (!isRoleFilter) {
    if (window.__yysCbgRoleSearchNavigating) return { status: "navigating" };
    const officialCbgHosts = new Set(["yys.cbg.163.com", "cbg.163.com"]);
    const entry = [
      ...document.querySelectorAll("a,button,[role=link],[role=button]"),
    ].find(
      (element) =>
        visible(element) && normalize(element.innerText) === "角色筛选",
    );
    if (entry) {
      if (entry instanceof HTMLAnchorElement) {
        const target = new URL(entry.href, location.href);
        const sameChannel =
          target.host === location.host ||
          (officialCbgHosts.has(target.hostname) &&
            officialCbgHosts.has(location.hostname));
        if (!sameChannel) return { status: "role_filter_not_open" };
      }
      window.__yysCbgRoleSearchNavigating = true;
      window.setTimeout(() => {
        window.__yysCbgRoleSearchNavigating = false;
      }, 5000);
      entry.click();
      return { status: "navigating" };
    }
    window.__yysCbgRoleSearchNavigating = true;
    window.setTimeout(() => {
      window.__yysCbgRoleSearchNavigating = false;
    }, 5000);
    // 藏宝阁首页入口在部分布局中不可见时，直接打开当前站点的角色筛选页。
    window.location.href = new URL(
      "/cgi/mweb/advance/search?search_type=role&view_loc=search_cond&tfid=f_kingkong&backurl=%2Fpl",
      location.origin,
    ).href;
    return { status: "navigating" };
  }

  let expandedSection = false;
  for (const section of document.querySelectorAll(
    '[aria-expanded="false"],summary:not([open])',
  )) {
    const popup = section.getAttribute("aria-haspopup");
    if (
      visible(section) &&
      normalize(section.innerText) &&
      !section.matches('[role="combobox"]') &&
      (!popup || popup === "false")
    ) {
      if (section instanceof HTMLSummaryElement) {
        const details = section.closest("details");
        if (details) details.open = true;
        else section.click();
      } else {
        section.click();
      }
      expandedSection = true;
    }
  }
  for (const section of document.querySelectorAll("details:not([open])")) {
    section.open = true;
    expandedSection = true;
  }
  if (expandedSection) return { status: "expanding" };

  const unsupported = [];
  const applied = [];
  const pendingOptionState = window.__yysCbgRoleSearchPendingOptions;
  const pendingOptions = new Set(
    pendingOptionState?.expiresAt > Date.now()
      ? (pendingOptionState.options ?? [])
      : [],
  );
  let waitingForOptions = false;
  const namedInput = (hints) =>
    [...document.querySelectorAll("input:not([type=hidden]),textarea")]
      .filter(visible)
      .find((input) => {
        const accessible = [
          input.getAttribute("placeholder"),
          input.getAttribute("aria-label"),
          input.getAttribute("title"),
          ...[...(input.labels ?? [])].map((label) => label.innerText),
        ]
          .map(normalize)
          .join(" ");
        return hints.some((hint) => accessible.includes(normalize(hint)));
      });
  const setInput = (input, value) => {
    const prototype =
      input instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
    if (!setter) return false;
    const number = Number(value);
    const inputValue =
      value !== "" && Number.isFinite(number)
        ? String(Number(number.toFixed(1)))
        : String(value);
    setter.call(input, inputValue);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    input.dispatchEvent(new Event("blur", { bubbles: true }));
    return true;
  };
  const inputNear = (label) => {
    const normalizedLabel = normalize(label).replace(/[：:≥≤].*$/, "");
    const exactLabel = [
      ...document.querySelectorAll("label,[aria-label],span,div,p"),
    ]
      .filter((element) => {
        const text = normalize(element.innerText).replace(/[：:≥≤].*$/, "");
        return (
          visible(element) &&
          text.includes(normalizedLabel) &&
          text.length <= normalizedLabel.length + 12
        );
      })
      .sort((a, b) => {
        const textLength =
          normalize(a.innerText).length - normalize(b.innerText).length;
        return textLength || a.children.length - b.children.length;
      })[0];
    if (!exactLabel) return undefined;
    if (exactLabel instanceof HTMLLabelElement && exactLabel.control)
      return exactLabel.control;
    let parent = exactLabel;
    for (
      let depth = 0;
      depth < 5 && parent;
      depth += 1, parent = parent.parentElement
    ) {
      const control = [
        ...parent.querySelectorAll("input:not([type=hidden]),textarea"),
      ].find(visible);
      if (control) return control;
    }
    return undefined;
  };
  const inputForLabel = (label) => {
    const target = normalize(label).replace(/[：:≥≤].*$/, "");
    const inputs = [
      ...document.querySelectorAll("input:not([type=hidden]),textarea"),
    ].filter(visible);
    const attributeMatch = inputs.find((input) =>
      [
        input.getAttribute("aria-label"),
        input.getAttribute("title"),
        ...[...(input.labels ?? [])].map((item) => item.innerText),
      ]
        .map(normalize)
        .some((text) => text.includes(target)),
    );
    if (attributeMatch) return attributeMatch;

    const relatedInputs = [];
    for (const input of inputs) {
      let parent = input.parentElement;
      for (
        let depth = 0;
        depth < 6 && parent;
        depth += 1, parent = parent.parentElement
      ) {
        const text = normalize(parent.innerText);
        if (text.includes(target) && text.length <= target.length + 20) {
          relatedInputs.push({ input, score: depth * 100 + text.length });
          break;
        }
      }
    }
    return relatedInputs.sort((a, b) => a.score - b.score)[0]?.input;
  };
  const setNumber = (key, value, label) => {
    if (value === null || value === undefined) return;
    const input =
      inputNear(label) ?? inputForLabel(label) ?? namedInput([label]);
    if (input && setInput(input, value)) {
      applied.push(label);
      return;
    }
    const slider = sliderNear(label);
    if (slider && setSlider(slider, value)) applied.push(label);
    else unsupported.push(label);
  };
  const exactText = (value, allowPartial = false) =>
    [
      ...document.querySelectorAll(
        "label,button,a,[aria-label],[role=checkbox],[role=radio],[role=option],[role=switch],[aria-checked],[aria-selected],[aria-pressed],li,span,div",
      ),
    ]
      .filter((element) => {
        const text = normalize(
          element.getAttribute("aria-label") || element.innerText,
        );
        const target = normalize(value);
        return (
          visible(element) &&
          (text === target ||
            (allowPartial &&
              text.includes(target) &&
              text.length <= target.length + 8)) &&
          ![...element.children].some((child) =>
            normalize(
              child.getAttribute("aria-label") || child.innerText,
            ).includes(target),
          )
        );
      })
      .sort((a, b) => {
        const textLength =
          normalize(a.getAttribute("aria-label") || a.innerText).length -
          normalize(b.getAttribute("aria-label") || b.innerText).length;
        return textLength || a.children.length - b.children.length;
      })[0];
  const sliderNear = (label) => {
    const target = normalize(label).replace(/[：:≥≤].*$/, "");
    const text = exactText(target) ?? exactText(target, true);
    if (!text) return undefined;
    let branch = text;
    for (let depth = 0; depth < 6 && branch.parentElement; depth += 1) {
      const parent = branch.parentElement;
      const parentText = normalize(parent.innerText);
      if (
        parentText.includes(target) &&
        parentText.length <= target.length + 40
      ) {
        const sliders = [
          ...parent.querySelectorAll('input[type="range"],[role="slider"]'),
        ]
          .filter(visible)
          .sort((a, b) => {
            const centerY = (element) => {
              const rect = element.getBoundingClientRect();
              return rect.top + rect.height / 2;
            };
            return (
              Math.abs(centerY(a) - centerY(text)) -
              Math.abs(centerY(b) - centerY(text))
            );
          });
        if (sliders.length) return sliders[0];
      }
      branch = parent;
    }
    return undefined;
  };
  const setSlider = (slider, value) => {
    const target = Number(value);
    if (!Number.isFinite(target)) return false;
    const normalizedTarget = Number(target.toFixed(1));
    if (slider instanceof HTMLInputElement && slider.type === "range") {
      return setInput(slider, normalizedTarget);
    }
    const current = Number(slider.getAttribute("aria-valuenow"));
    const minimum = Number(slider.getAttribute("aria-valuemin") ?? 0);
    const maximum = Number(slider.getAttribute("aria-valuemax"));
    const step = Number(
      slider.getAttribute("aria-valuestep") ??
        slider.getAttribute("step") ??
        slider.getAttribute("data-step") ??
        1,
    );
    const steps = Math.round((normalizedTarget - current) / step);
    if (
      !Number.isFinite(current) ||
      !Number.isFinite(minimum) ||
      !Number.isFinite(maximum) ||
      !Number.isFinite(step) ||
      step <= 0 ||
      normalizedTarget < minimum ||
      normalizedTarget > maximum ||
      Math.abs(steps) > 1000 ||
      Math.abs(current + steps * step - normalizedTarget) > 0.000001
    )
      return false;
    slider.focus();
    const key = steps < 0 ? "ArrowLeft" : "ArrowRight";
    for (let index = 0; index < Math.abs(steps); index += 1) {
      slider.dispatchEvent(
        new KeyboardEvent("keydown", { key, bubbles: true }),
      );
    }
    return (
      Math.abs(
        Number(slider.getAttribute("aria-valuenow")) - normalizedTarget,
      ) < 0.000001
    );
  };
  const adjacentOption = (text, value) => {
    const target = normalize(value);
    const labelRect = text.getBoundingClientRect();
    let branch = text;
    for (let depth = 0; depth < 6 && branch.parentElement; depth += 1) {
      const parent = branch.parentElement;
      const parentText = normalize(parent.innerText);
      if (
        parentText.includes(target) &&
        parentText.length <= target.length + 48
      ) {
        const selector =
          'input[type=checkbox],input[type=radio],button,[role=checkbox],[role=radio],[role=switch],[role=option],[aria-checked],[aria-selected],[aria-pressed],[class*="switch"],[class*="toggle"],[class*="checkbox"],[class*="check"]';
        const controls = [...parent.querySelectorAll(selector)];
        const sameRow = controls
          .filter((element) => {
            const rect = element.getBoundingClientRect();
            return (
              rect.width > 0 &&
              rect.height > 0 &&
              rect.left >= labelRect.right - 6 &&
              Math.abs(
                rect.top +
                  rect.height / 2 -
                  (labelRect.top + labelRect.height / 2),
              ) <= Math.max(16, labelRect.height)
            );
          })
          .sort(
            (a, b) =>
              a.getBoundingClientRect().left - b.getBoundingClientRect().left,
          );
        if (sameRow.length) return sameRow[0];
        if (controls.length) return controls[0];

        // shortcut: 依赖当前开关尺寸与同行布局；藏宝阁改版时升级为站点专用选择器。
        const visualControl = [...parent.querySelectorAll("*")]
          .filter((element) => {
            const rect = element.getBoundingClientRect();
            return (
              rect.width >= 40 &&
              rect.width <= 100 &&
              rect.height >= 20 &&
              rect.height <= 50 &&
              rect.left >= labelRect.right - 6 &&
              Math.abs(
                rect.top +
                  rect.height / 2 -
                  (labelRect.top + labelRect.height / 2),
              ) <= Math.max(16, labelRect.height)
            );
          })
          .sort(
            (a, b) =>
              a.getBoundingClientRect().left - b.getBoundingClientRect().left,
          )[0];
        if (visualControl) return visualControl;
      }
      branch = parent;
    }
    return undefined;
  };
  const visualToggleState = (option) => {
    const rect = option.getBoundingClientRect();
    if (
      rect.width < 40 ||
      rect.width > 100 ||
      rect.height < 20 ||
      rect.height > 50
    )
      return null;
    const knob = [option, ...option.querySelectorAll("*")]
      .map((element) => ({ element, rect: element.getBoundingClientRect() }))
      .filter(
        ({ rect: knobRect }) =>
          knobRect.width >= 12 &&
          Math.abs(knobRect.width - knobRect.height) <= 6 &&
          knobRect.width < rect.width * 0.6 &&
          knobRect.left >= rect.left &&
          knobRect.right <= rect.right &&
          Math.abs(
            knobRect.top + knobRect.height / 2 - (rect.top + rect.height / 2),
          ) <= 8,
      )
      .sort((a, b) => b.rect.width - a.rect.width)[0]?.rect;
    if (knob) {
      const position = (knob.left + knob.width / 2 - rect.left) / rect.width;
      if (position < 0.45) return false;
      if (position > 0.55) return true;
    }
    const channels = getComputedStyle(option)
      .backgroundColor.match(/[\d.]+/g)
      ?.slice(0, 3)
      .map(Number);
    if (channels?.length === 3) {
      const [red, green, blue] = channels;
      const spread = Math.max(red, green, blue) - Math.min(red, green, blue);
      if (spread < 18 && red > 90 && red < 225) return false;
      if (spread > 25 && Math.max(red, green, blue) > 150) return true;
    }
    return null;
  };
  const optionState = (option) => {
    const elements = [option, ...option.querySelectorAll("*")];
    const input = elements.find(
      (element) =>
        element instanceof HTMLInputElement &&
        ["checkbox", "radio"].includes(element.type),
    );
    if (input) return input.checked;
    for (const element of elements) {
      for (const name of ["aria-checked", "aria-selected", "aria-pressed"]) {
        const value = element.getAttribute(name);
        if (value === "true") return true;
        if (value === "false") return false;
      }
      const dataState =
        element.getAttribute("data-state") ??
        element.getAttribute("data-checked");
      if (
        dataState === "checked" ||
        dataState === "true" ||
        dataState === "selected"
      ) {
        return true;
      }
      if (
        dataState === "unchecked" ||
        dataState === "false" ||
        dataState === "unselected"
      ) {
        return false;
      }
    }
    const className = elements
      .map((element) => element.getAttribute("class") ?? "")
      .join(" ");
    if (
      /(^|\s|[-_])(active|selected|checked|current|cur|choose|on|is-on)(\s|[-_]|$)/i.test(
        className,
      )
    )
      return true;
    if (
      /(^|\s|[-_])(inactive|unselected|unchecked|is-off)(\s|[-_]|$)/i.test(
        className,
      )
    )
      return false;
    if (option.matches("li")) {
      const textElement = [...elements]
        .reverse()
        .find(
          (element) =>
            normalize(element.innerText) === normalize(option.innerText),
        );
      const color = getComputedStyle(textElement ?? option)
        .color.match(/[\d.]+/g)
        ?.slice(0, 3)
        .map(Number);
      if (color?.length === 3) {
        const [red, green, blue] = color;
        if (red > 150 && red > green * 1.5 && red > blue * 1.5) return true;
        if (Math.max(red, green, blue) - Math.min(red, green, blue) < 30)
          return false;
      }
    }
    const visualState = visualToggleState(option);
    if (visualState !== null) return visualState;
    if (/(option|item|checkbox|radio|tag|switch|toggle)/i.test(className))
      return false;
    return null;
  };
  const ensureOption = (value, searchHint = "") => {
    let text = exactText(value) ?? exactText(value, true);
    if (!text && searchHint) {
      const search = namedInput([searchHint]);
      if (search && setInput(search, value)) {
        text = exactText(value) ?? exactText(value, true);
      }
    }
    if (!text) return false;
    const option =
      adjacentOption(text, value) ??
      text.closest(
        "label,button,[role=checkbox],[role=radio],[role=option],[role=switch],[aria-checked],[aria-selected],[aria-pressed]",
      ) ??
      text.closest(
        'li,[class*="option"],[class*="item"],[class*="radio"],[class*="tag"],[class*="switch"],[class*="toggle"],[class*="checkbox"],[class*="check"]',
      ) ??
      text;
    const state = optionState(option);
    const pendingKey = normalize(value);
    if (state === true) {
      pendingOptions.delete(pendingKey);
      return true;
    }
    if (pendingOptions.has(pendingKey)) {
      pendingOptions.delete(pendingKey);
      return false;
    }
    if (state === null) return false;
    option.click();
    pendingOptions.add(pendingKey);
    waitingForOptions = true;
    return true;
  };
  const numberLabels = {
    minimumMaxSpeedCount: "满速御魂数 ≥",
    minimumScatteredSpeed: "散件一速 ≥",
    minimumLuckySpeed: "招财一速 ≥",
    minimumHeadCount: "头个数 ≥",
    minimumHeadSpeed: "头速度 ≥",
    minimumTailCount: "尾个数 ≥",
    minimumTailSpeed: "尾速度 ≥",
    minimumLuckyHeadCount: "招财头个数 ≥",
    minimumLuckyHeadSpeed: "招财头速度 ≥",
    minimumSixStarHeroCount: "6星式神数量 ≥",
    minimumStyle: "风姿度 ≥",
    minimumSignInDays: "签到天数 ≥",
    maximumLevel: "等级 ≤",
    jade: "勾玉",
    mysteryAmulet: "神秘符咒",
    stamina: "体力",
    goldWan: "金币（万）",
    goldenAmulet: "金御札",
    jadeStone: "魂玉",
    御札: "御札",
    逢魔之魂: "逢魔之魂",
    大蛇的逆鳞: "大蛇的逆鳞",
    御行达摩: "御行达摩",
    皮肤券: "皮肤券",
    勋章: "勋章",
    六星结界卡: "六星结界卡",
    满级御魂: "满级御魂",
    式神皮肤总数: "式神皮肤总数",
    典藏皮肤总数: "典藏皮肤总数",
    庭院皮肤总数: "庭院皮肤总数",
    召唤屋皮肤总数: "召唤屋皮肤总数",
    幕间皮肤总数: "幕间皮肤总数",
    战斗主题总数: "战斗主题总数",
    阴阳术皮肤总数: "阴阳术皮肤总数",
  };

  const numberFilterKeys = Object.entries(criteria.numberFilters ?? {})
    .filter(([, value]) => value !== null && value !== undefined)
    .map(([key]) => key);
  const requestedGroups = [
    {
      title: "平台",
      required: (criteria.platforms?.length ?? 0) > 0,
      ready: () =>
        (criteria.platforms ?? []).every((value) =>
          Boolean(exactText(value, true)),
        ),
    },
    {
      title: "图鉴",
      required: (criteria.dexRequirements?.length ?? 0) > 0,
      ready: () =>
        (criteria.dexRequirements ?? []).every((value) =>
          Boolean(
            exactText(
              { ssr: "SSR", sp: "SP", ur: "UR", collaboration: "联动" }[
                value
              ] ?? value,
              true,
            ),
          ),
        ),
    },
    {
      title: "资产",
      required:
        (criteria.assetFlags?.length ?? 0) > 0 ||
        numberFilterKeys.some((key) =>
          [
            "jade",
            "mysteryAmulet",
            "stamina",
            "goldWan",
            "goldenAmulet",
            "jadeStone",
            "御札",
            "逢魔之魂",
            "大蛇的逆鳞",
            "御行达摩",
            "皮肤券",
            "勋章",
            "六星结界卡",
            "满级御魂",
          ].includes(key),
        ),
      ready: () => Boolean(exactText("勾玉") || exactText("曜之阁开启")),
    },
    {
      title: "皮肤",
      required:
        (criteria.skinNames?.length ?? 0) > 0 ||
        numberFilterKeys.some((key) =>
          [
            "minimumStyle",
            "式神皮肤总数",
            "典藏皮肤总数",
            "庭院皮肤总数",
            "召唤屋皮肤总数",
            "幕间皮肤总数",
            "战斗主题总数",
            "阴阳术皮肤总数",
          ].includes(key),
        ),
      ready: () => Boolean(exactText("风姿度") || exactText("式神皮肤总数")),
    },
    {
      title: "头像框",
      required:
        (criteria.avatarFrames?.length ?? 0) > 0 ||
        Boolean(criteria.goldenAvatarFrame),
      ready: () => Boolean(exactText("百鬼之主")),
    },
    {
      title: "徽章",
      required: (criteria.badges?.length ?? 0) > 0,
      ready: () => Boolean(exactText("秘闻天下一")),
    },
    {
      title: "成就/签到",
      required:
        (criteria.achievements?.length ?? 0) > 0 ||
        (criteria.numberFilters?.minimumSignInDays !== null &&
          criteria.numberFilters?.minimumSignInDays !== undefined),
      ready: () => Boolean(exactText("征服世界") || exactText("签到天数")),
    },
  ];
  const pendingExpansion = window.__yysCbgRoleSearchPendingGroups;
  const pendingGroups = new Set(
    pendingExpansion?.expiresAt > Date.now()
      ? (pendingExpansion.groups ?? []).filter((title) =>
          requestedGroups.some(
            (group) => group.required && group.title === title,
          ),
        )
      : [],
  );
  let waitingForExpansion = false;
  for (const group of requestedGroups) {
    if (!group.required) continue;
    if (group.ready()) {
      pendingGroups.delete(group.title);
      continue;
    }
    const section = exactText(group.title);
    if (!section) {
      unsupported.push(group.title);
      continue;
    }
    waitingForExpansion = true;
    if (!pendingGroups.has(group.title)) {
      section.click();
      pendingGroups.add(group.title);
    }
  }
  if (waitingForExpansion) {
    if (unsupported.length) return { status: "unsupported", unsupported };
    window.__yysCbgRoleSearchPendingGroups = {
      groups: [...pendingGroups],
      expiresAt: Date.now() + 4000,
    };
    return { status: "expanding" };
  }
  delete window.__yysCbgRoleSearchPendingGroups;

  if (criteria.minimumPrice !== null && criteria.minimumPrice !== undefined) {
    const input = namedInput(["最低", "最低价"]);
    if (!input || !setInput(input, criteria.minimumPrice))
      unsupported.push("最低价格");
    else applied.push("最低价格");
  }
  if (criteria.maximumPrice !== null && criteria.maximumPrice !== undefined) {
    const input = namedInput(["最高", "最高价"]);
    if (!input || !setInput(input, criteria.maximumPrice))
      unsupported.push("最高价格");
    else applied.push("最高价格");
  }
  for (const [key, value] of Object.entries(criteria.numberFilters ?? {})) {
    if (value === null || value === undefined) continue;
    const label = numberLabels[key];
    if (!label) unsupported.push(key);
    else setNumber(key, value, label);
  }

  const optionGroups = [
    [
      criteria.platforms,
      {
        iOS: ["iOS（苹果手机）", "iOS"],
        Android: ["Android（安卓手机）", "Android"],
      },
      "平台",
    ],
    [
      criteria.dexRequirements,
      {
        ssr: ["SSR 全图鉴", "SSR"],
        sp: ["SP 全图鉴", "SP"],
        ur: ["UR全图鉴", "UR 全图鉴", "UR"],
        collaboration: ["联动全图鉴", "联动"],
      },
      "图鉴",
    ],
    [criteria.assetFlags, {}, "资产"],
    [criteria.skinNames, {}, "皮肤"],
    [criteria.avatarFrames, {}, "头像框"],
    [criteria.badges, {}, "徽章"],
    [criteria.achievements, {}, "成就"],
  ];
  for (const [values, labels, searchHint] of optionGroups) {
    for (const value of values ?? []) {
      const candidates = labels[value] ?? [value];
      const matched = candidates.find((label) =>
        ensureOption(label, searchHint),
      );
      if (matched) applied.push(matched);
      else unsupported.push(candidates[0]);
    }
  }
  if (criteria.goldenAvatarFrame && !ensureOption("京都之主"))
    unsupported.push("京都之主（金达摩）");
  if (!waitingForOptions && criteria.selectedServers?.length) {
    const pickerTitle = exactText("区服选择");
    let selection = window.__yysCbgRoleSearchPendingServers;
    const selectionCriteria = JSON.stringify(criteria.selectedServers);
    if (selection && selection.criteria !== selectionCriteria) {
      delete window.__yysCbgRoleSearchPendingServers;
      selection = undefined;
    }
    if (selection?.phase === "confirming") {
      if (pickerTitle) unsupported.push("区服选择确认");
      else {
        applied.push("区服");
        delete window.__yysCbgRoleSearchPendingServers;
      }
    } else if (!pickerTitle) {
      if (selection?.phase === "opening" && selection.attempts < 2) {
        selection.attempts += 1;
        window.__yysCbgRoleSearchPendingServers = selection;
        return { status: "expanding" };
      }
      const trigger = [...document.querySelectorAll("a,button,[role=button]")]
        .filter(visible)
        .find((element) => normalize(element.innerText).startsWith("区服"));
      if (!trigger) {
        unsupported.push("区服");
        delete window.__yysCbgRoleSearchPendingServers;
      } else if (selection?.phase === "selecting") {
        trigger.click();
        return { status: "expanding" };
      } else if (selection) {
        unsupported.push("区服选择");
        delete window.__yysCbgRoleSearchPendingServers;
      } else {
        window.__yysCbgRoleSearchPendingServers = {
          phase: "opening",
          criteria: selectionCriteria,
          attempts: 1,
          activeGroup: null,
          completedGroups: [],
        };
        trigger.click();
        return { status: "expanding" };
      }
    } else {
      selection ??= {
        phase: "opening",
        criteria: selectionCriteria,
        attempts: 0,
        activeGroup: null,
        completedGroups: [],
      };
      if (selection.phase !== "selecting") {
        const headingRect = pickerTitle.getBoundingClientRect();
        const reset = [...document.querySelectorAll("a,button,[role=button]")]
          .filter(
            (element) =>
              visible(element) && normalize(element.innerText) === "重置",
          )
          .sort((a, b) => {
            const distance = (element) =>
              Math.abs(element.getBoundingClientRect().top - headingRect.top);
            return distance(a) - distance(b);
          })[0];
        if (!reset) {
          unsupported.push("区服重置");
          return { status: "unsupported", applied, unsupported };
        }
        reset.click();
        selection.phase = "selecting";
        selection.activeGroup = null;
        selection.completedGroups = [];
        window.__yysCbgRoleSearchPendingServers = selection;
        return { status: "expanding" };
      }
      const serverGroups = new Map();
      let serverSelectionUnsupported = false;
      for (const value of criteria.selectedServers) {
        const [group, ...parts] = String(value).split("/");
        const name = parts.join("/");
        if (!group || !name) {
          unsupported.push("区服");
          serverSelectionUnsupported = true;
          continue;
        }
        const labels =
          group === "网易-双平台" ? [name, `网易-${name}`] : [name];
        serverGroups.set(group, [...(serverGroups.get(group) ?? []), labels]);
      }

      let switchedGroup = false;
      for (const [group, labels] of serverGroups) {
        if (selection.completedGroups.includes(group)) continue;
        if (selection.activeGroup !== group) {
          const tab = exactText(group);
          if (!tab) {
            unsupported.push(group);
            serverSelectionUnsupported = true;
            continue;
          }
          tab.click();
          selection.activeGroup = group;
          selection.groupPlan = null;
          selection.groupWaits = 0;
          switchedGroup = true;
          break;
        }
        const all = exactText("全选");
        const matches = (item, candidates) =>
          candidates.some(
            (label) => normalize(item.innerText) === normalize(label),
          );
        let area = all?.parentElement;
        let items = [];
        while (area && area !== document.body) {
          items = [...area.querySelectorAll("li")].filter(
            (item) =>
              visible(item) &&
              !item.querySelector("a") &&
              normalize(item.innerText),
          );
          if (items.some((item) => matches(item, labels[0]))) break;
          area = area.parentElement;
        }
        const selected = labels.map((candidates) =>
          items.find((item) => matches(item, candidates)),
        );
        if (
          !all ||
          selected.some((item) => !item) ||
          new Set(selected).size !== labels.length
        ) {
          if ((selection.groupWaits ?? 0) < 8) {
            selection.groupWaits = (selection.groupWaits ?? 0) + 1;
            window.__yysCbgRoleSearchPendingServers = selection;
            return { status: "expanding" };
          }
          unsupported.push(`${group}区服选项`);
          serverSelectionUnsupported = true;
          continue;
        }
        if (!selection.groupPlan) {
          const excluded = items.filter((item) => !selected.includes(item));
          const useAll = 1 + excluded.length < selected.length;
          selection.groupPlan = {
            useAll,
            allClicked: false,
            targets: (useAll ? excluded : selected).map((item) =>
              normalize(item.innerText),
            ),
            index: 0,
            pending: null,
          };
        }
        const plan = selection.groupPlan;
        if (plan.useAll && !plan.allClicked) {
          all.click();
          plan.allClicked = true;
          window.__yysCbgRoleSearchPendingServers = selection;
          return { status: "expanding" };
        }
        while (plan.index < plan.targets.length) {
          const label = plan.targets[plan.index];
          const item = items.find(
            (candidate) => normalize(candidate.innerText) === label,
          );
          const state = item ? optionState(item) : null;
          if (state === !plan.useAll) {
            plan.pending = null;
            plan.index += 1;
          } else if (state === null || plan.pending === label) {
            unsupported.push(label);
            serverSelectionUnsupported = true;
            break;
          } else {
            item.click();
            plan.pending = label;
            window.__yysCbgRoleSearchPendingServers = selection;
            return { status: "expanding" };
          }
        }
        if (serverSelectionUnsupported) continue;
        if (
          items.some((item) => optionState(item) !== selected.includes(item))
        ) {
          unsupported.push(`${group}区服选择状态`);
          serverSelectionUnsupported = true;
          continue;
        }
        selection.groupPlan = null;
        selection.completedGroups.push(group);
      }

      window.__yysCbgRoleSearchPendingServers = selection;
      if (switchedGroup) return { status: "expanding" };
      if (
        !waitingForOptions &&
        !serverSelectionUnsupported &&
        selection.completedGroups.length === serverGroups.size
      ) {
        const headingRect = pickerTitle.getBoundingClientRect();
        const done = [...document.querySelectorAll("a,button,[role=button]")]
          .filter(
            (element) =>
              visible(element) && normalize(element.innerText) === "完成",
          )
          .sort((a, b) => {
            const distance = (element) =>
              Math.abs(element.getBoundingClientRect().top - headingRect.top);
            return distance(a) - distance(b);
          })[0];
        if (!done) unsupported.push("区服选择确认");
        else {
          done.click();
          selection.phase = "confirming";
          window.__yysCbgRoleSearchPendingServers = selection;
          return { status: "expanding" };
        }
      }
    }
  }
  if (criteria.publication === "only" && !ensureOption("只看公示期"))
    unsupported.push("只看公示期");
  if (criteria.publication === "exclude" && !ensureOption("不看公示期"))
    unsupported.push("不看公示期");

  if (waitingForOptions) {
    window.__yysCbgRoleSearchPendingOptions = {
      options: [...pendingOptions],
      expiresAt: Date.now() + 4000,
    };
    return { status: "option_pending" };
  }
  delete window.__yysCbgRoleSearchPendingOptions;

  if (unsupported.length)
    return { status: "unsupported", applied, unsupported };
  if (!applied.length) return { status: "no_conditions" };

  const done = [...document.querySelectorAll("button,[role=button],a,div,span")]
    .filter(
      (element) => visible(element) && normalize(element.innerText) === "完成",
    )
    .sort((a, b) => a.children.length - b.children.length)[0];
  if (!done) return { status: "submit_not_found", applied };
  const rect = done.getBoundingClientRect();
  return {
    status: "ready_to_submit",
    applied,
    click: {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
      scale: window.devicePixelRatio,
    },
  };
})();
