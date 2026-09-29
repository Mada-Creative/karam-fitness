# Calculator — حاسبة علمية للموبايل

حاسبة علمية كاملة بتشتغل على التلفون كتطبيق (PWA): بتنزّلها على الشاشة الرئيسية وبتشتغل بدون إنترنت.
التصميم والاسم والكود كلهم أصليين؛ ما في أي شعار أو علامة تجارية أو تصميم منسوخ من شركة ثانية.

A full scientific calculator for phones, built as an installable, offline-capable web app.
Original name, design and code: no third-party trademarks, logos or copied artwork.

## المميزات · Features

| الوضع · Mode | شو بيعمل · What it does |
|---|---|
| **COMP** | حسابات عامة بأولوية عمليات صحيحة، نتائج دقيقة (كسور، جذور √، مضاعفات π)، `S⇔D` للتحويل لعشري |
| | sin/cos/tan وعكسها، hyp، log، ln، log بأساس (`log(a,b)`)، جذور، أسس، `x!`، `nPr`، `nCr`، `%` |
| | ∫ تكامل، d/dx اشتقاق، Σ مجموع، Π ضرب، Pol/Rec، GCD، LCM، Int، Intg، Rnd، Ran#، RanInt# |
| | متغيرات A–F، M، X، Y مع `STO` و `RCL`، ذاكرة `M+`/`M−`، `Ans`، `ENG`، سجل العمليات |
| | **CALC** (بيسألك عن قيم المتغيرات) و **SOLVE** (بيحل معادلة مثل `X²=2`) |
| **EQN** | معادلتين بمجهولين، ثلاث معادلات بثلاث مجاهيل، معادلات تربيعية وتكعيبية ودرجة رابعة (مع حلول مركبة، وحلول دقيقة مثل `1 ± √2`) |
| **STAT** | إحصاء متغير واحد (المتوسط، الانحراف المعياري، الربيعيات...) وانحدار خطي `y = a + bx` |
| **TABLE** | جدول قيم لـ f(X) و g(X) |
| **BASE-N** | عشري، ست عشري، ثنائي، ثماني (32-bit) مع and / or / xor / xnor / Not / Neg |
| **SETUP** | Deg / Rad / Gra، Fix، Sci، Norm 1/2، تشغيل/إيقاف النتائج الدقيقة، اهتزاز الأزرار |

## طريقة الاستخدام · Keys

- **SHIFT** (برتقالي) بيفعّل الوظيفة المكتوبة بالبرتقالي فوق الزر، و **ALPHA** (فيروزي) للمتغيرات والحروف.
- `MODE` لتغيير الوضع، `SHIFT` + `MODE` للإعدادات، `HIST` لسجل العمليات، `SHIFT` + `HIST` لعرض المتغيرات.
- `STO` وبعده زر المتغير (مثلاً `(−)` = A) لتخزين النتيجة.
- الأسهم ▲▼ بترجعلك العمليات السابقة، و ◀ ▶ للتعديل على العملية.
- المعادلة لـ SOLVE: `ALPHA` + `CALC` بيكتب `=`، مثال: `X² = 2` وبعدين `SHIFT` + `CALC`.
- على الكمبيوتر بتقدر تستخدم الكيبورد (أرقام، عمليات، Enter، Backspace، Esc، الأسهم).

## التثبيت على التلفون · Install on your phone

1. من إعدادات الريبو على GitHub: **Settings → Pages → Source: GitHub Actions**.
2. أي push على `main` بيشغّل الاختبارات وبينشر التطبيق على
   `https://<username>.github.io/calculator/`.
3. افتح الرابط على التلفون:
   - **Android (Chrome):** القائمة ⋮ ← *Add to Home screen / Install app*.
   - **iPhone (Safari):** زر المشاركة ← *Add to Home Screen*.

بعد التثبيت بيفتح كتطبيق كامل الشاشة وبيشتغل بدون إنترنت.

## التطوير · Development

```bash
npm test      # engine unit tests (Node 18+)
npm start     # serve locally at http://localhost:8080
```

```
index.html              page shell
css/styles.css          design
js/engine.js            parser, evaluator, solvers, statistics, base-N (no DOM, unit-tested)
js/app.js               keypad, screens, modes, persistence
sw.js                   offline cache
manifest.webmanifest    install metadata
tests/engine.test.js    unit tests
```
