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

## تطبيق أندرويد · Android app

التطبيق مبني كتطبيق أندرويد حقيقي (APK) باستخدام Capacitor: بيظهر بقائمة التطبيقات بأيقونته، بيفتح كامل الشاشة، زر الرجوع بيشتغل، وبدون إنترنت.

1. أي push على `main` بيبني ملف **Calculator.apk** تلقائياً (GitHub Actions ← *Android APK*) وبينشره بصفحة **Releases** بالريبو.
2. من التلفون افتح `https://github.com/Mada-Creative/<repo>/releases/latest` ونزّل `Calculator.apk`.
3. افتح الملف واسمح بـ *Install unknown apps* لأول مرة، وبعدين *Install*.

**توقيع ثابت للتحديثات (اختياري بس مستحسن):** بدون توقيع خاص، كل بناء بيتوقّع بمفتاح debug مختلف، فلازم تحذف النسخة القديمة قبل ما تنزّل الجديدة.
لتحديثات مباشرة فوق القديم، اعمل keystore مرة وحدة:

```bash
keytool -genkeypair -v -keystore release.jks -alias calculator -keyalg RSA -keysize 2048 -validity 10000
base64 -w0 release.jks   # انسخ الناتج
```

وحط بالريبو (**Settings → Secrets and variables → Actions**):
`ANDROID_KEYSTORE_BASE64`، `ANDROID_KEYSTORE_PASSWORD`، `ANDROID_KEY_ALIAS` (= calculator)، `ANDROID_KEY_PASSWORD`.
احتفظ بملف `release.jks` بمكان آمن، وما تحطه بالريبو.

**iPhone:** تطبيق iOS حقيقي بيحتاج جهاز Mac وحساب Apple Developer (99$ بالسنة). لحد ذلك، النسخة الويب بتشتغل على الآيفون:
فعّل **Settings → Pages → Source: GitHub Actions**، افتح `https://<username>.github.io/<repo>/` بـ Safari ← مشاركة ← *Add to Home Screen*.

## التطوير · Development

```bash
npm test              # engine unit tests (Node 18+)
npm start             # serve locally at http://localhost:8080
npm run android:sync  # copy the web app into the Android project
npx cap open android  # open in Android Studio (optional, for local builds)
```

```
index.html              page shell
css/styles.css          design
js/engine.js            parser, evaluator, solvers, statistics, base-N (no DOM, unit-tested)
js/app.js               keypad, screens, modes, persistence
sw.js                   offline cache (web only)
manifest.webmanifest    web install metadata
android/                Android (Capacitor) project
capacitor.config.json   app id and name
scripts/build-web.js    copies the web app into www/
tests/engine.test.js    unit tests
```
