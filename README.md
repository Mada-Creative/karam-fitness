# Calculator — حاسبة علمية (React Native)

تطبيق حاسبة علمية لـ **iOS و Android**، مكتوب بـ **React Native + Expo** بلغة **JavaScript**.
الاسم والتصميم والكود أصليين؛ ما في أي شعار أو علامة تجارية لشركة ثانية.

## المميزات

| الوضع | شو بيعمل |
|---|---|
| **COMP** | حسابات عامة، نتائج دقيقة (كسور، جذور √، π) مع `S⇔D`، مثلثات و hyp، log/ln، أسس وجذور، `x!`، `nPr`/`nCr`، ∫، d/dx، Σ، Π، Pol/Rec، GCD/LCM، متغيرات A–F/M/X/Y، `STO`/`RCL`، `M+`/`M−`، `Ans`، `ENG`، سجل العمليات، **CALC** و **SOLVE** |
| **EQN** | معادلتين/ثلاث بمجاهيل، ومعادلات درجة 2 و 3 و 4 (حلول مركبة، وحلول دقيقة مثل `1 ± √2`) |
| **STAT** | إحصاء متغير واحد، وانحدار خطي `y = a + bx` |
| **TABLE** | جدول قيم لـ f(X) و g(X) |
| **BASE-N** | DEC / HEX / BIN / OCT مع and / or / xor / xnor / Not / Neg |
| **SETUP** | Deg/Rad/Gra، Fix/Sci/Norm، النتائج الدقيقة، اهتزاز الأزرار |

الحالة (المتغيرات، السجل، الإعدادات) بتنحفظ على الجهاز، وزر الرجوع بأندرويد بيرجع خطوة خطوة.

## المتطلبات على اللابتوب

- **Node.js 20 أو أحدث** ([nodejs.org](https://nodejs.org)) و **git**
- حساب **Expo** مجاني: [expo.dev/signup](https://expo.dev/signup)
- للنشر: **Apple Developer** (99$ بالسنة) و **Google Play Console** (25$ مرة وحدة)

> ما بتحتاج Mac: البناء بيصير على سيرفرات Expo (EAS Build) وبتتحكم فيه من التيرمينال.

## 1) التشغيل والتجربة

```bash
git clone https://github.com/Mada-Creative/karam-fitness.git calculator
cd calculator
npm install
npx expo start
```

نزّل تطبيق **Expo Go** على تلفونك (App Store / Google Play)، وامسح الـ QR اللي بيطلع بالتيرمينال.
أي تعديل بالكود بيظهر فوراً على التلفون.

```bash
npm test    # اختبارات محرك الحسابات والمنطق
```

## 2) الإعداد لأول مرة (مرة وحدة)

```bash
npm install -g eas-cli
eas login        # بحساب Expo
eas init         # بيربط المشروع بحسابك وبيضيف projectId على app.json (اعمله commit)
```

**قبل أول بناء، راجع بـ `app.json`:**

- `ios.bundleIdentifier` و `android.package` (حالياً `com.madacreative.calculator`). ما بتقدر تغيّرهم بعد أول نشر.
- `name` هو الاسم تحت الأيقونة. اسم التطبيق بالمتجر لازم يكون **فريد**، و "Calculator" لحاله أكيد محجوز، فاختار اسم مميز بـ App Store Connect و Play Console.

## 3) iOS → App Store Connect

```bash
eas build --platform ios --profile production
eas submit --platform ios --latest
```

- أول `eas build` بيطلب تسجيل دخول Apple، وبيعمل الشهادات و provisioning لحاله.
- `eas submit` برفع النسخة على **App Store Connect** (وبيعمل سجل التطبيق إذا مش موجود). بعد المعالجة بتظهر بـ **TestFlight**.
- من App Store Connect: عبّي الوصف والصور و Privacy (التطبيق ما بيجمع أي بيانات)، وبعدين **Submit for Review**.

## 4) Android → Google Play

```bash
# نسخة تجريبية APK بتنزلها على أي تلفون مباشرة:
eas build --platform android --profile preview

# نسخة المتجر (AAB):
eas build --platform android --profile production
```

- **أول مرة لازم ترفع الـ AAB يدوياً**: حمّله من الرابط اللي بيعطيك إياه EAS، وبـ Play Console اعمل التطبيق وارفعه على *Internal testing*.
- بعد هيك الرفع بيصير من التيرمينال:
  ```bash
  eas submit --platform android --latest
  ```
  (بيطلب مفتاح Service Account من Google Cloud، وخطواته هون: [docs.expo.dev/submit/android](https://docs.expo.dev/submit/android/)).
- الحسابات الشخصية الجديدة على Google Play لازم تعمل **Closed testing مع 12 مختبر لمدة 14 يوم** قبل النشر للعامة.

## 5) تحديثات لاحقة

عدّل `version` بـ `app.json` (مثلاً `1.0.1`)، وبعدين نفس أوامر `eas build` و `eas submit`.
رقم البناء (build number / versionCode) بيزيد تلقائياً (`autoIncrement` بـ `eas.json`).

## بناء محلي (اختياري)

- **iOS**: بيحتاج Mac عليه Xcode: `npx expo run:ios --configuration Release`
- **Android**: بيحتاج Android Studio: `npx expo run:android --variant release`
- أو: `eas build --local --platform ios|android`

## هيكل المشروع

```
App.js                       الشاشة الرئيسية، الحفظ، زر الرجوع، الاهتزاز
index.js                     نقطة البداية
app.json                     الاسم، الأيقونات، bundle id / package
eas.json                     إعدادات البناء والرفع (EAS)
assets/                      الأيقونات وصورة البداية
src/core/engine.js           محرك الحسابات (parser، معادلات، إحصاء، base-N)
src/core/calculator.js       منطق الحاسبة والأوضاع (بدون واجهة، مختبَر)
src/core/keys.js             الأزرار وترتيبها
src/core/mathRuns.js         تحويل الأرقام لكسور/جذور/أسس للعرض
src/components/              Display، Keypad، MenuSheet، MathRun، ExprLine
tests/                       اختبارات (node --test)
```
