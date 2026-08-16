# 🏎️ Radin Racer 3D (رادین ریسر سه‌بعدی)

![Radin Racer 3D](https://img.shields.io/badge/WebGL-3D-00f0ff?style=for-the-badge)
![HTML5](https://img.shields.io/badge/HTML5-PWA-ff007f?style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-brightgreen?style=for-the-badge)

بازی آنلاین رانندگی سه‌بعدی **Radin Racer 3D** طراحی شده با موتور WebGL (Three.js)، خودروی تویوتا سوپرا سه‌بعدی، افکت‌های صوتی، حالت تعقیب و گریز پلیس و پشتیبانی از نسخه موبایل و اندروید.

## 🌟 ویژگی‌های بازی

- 🚗 **خودروی ۳ بعدی**: مدل سه‌بعدی تویوتا سوپرا با متریال‌های گرافیکی و نورپردازی واقع‌گرایانه
- 🚨 **حالت تعقیب پلیس**: ماشین‌های پلیس با آژیرهای چشمک‌زن سرخ و آبی و هوش مصنوعی تعقیب
- 🎵 **سیستم صوتی اختصاصی**: صدای موتور، دریفت، بوق، آژیر پلیس، برخورد و موزیک زمینه
- 📱 **پشتیبانی PWA**: قابلیت نصب مستقیم روی دسکتاپ و موبایل (Offline Capable)
- 🎮 **پشتیبانی از کنترل‌های متعددی**:
  - کیبورد (کلیدهای جهت‌نما / WASD)
  - لمسی (دکمه‌های روی صفحه برای موبایل)
- 🤖 **پروژه اندروید (Android Studio)**: آماده شده با WebView جهت تبدیل مستقیم به فایل APK

---

## 🚀 اجرا در مرورگر (Local Development)

به راحتی می‌توانید فایل `index.html` را در هر مرورگر مدرنی باز کنید:

```bash
# باز کردن مستقیم در مرورگر یا اجرا روی وب‌سرور محلی
npx serve .
```

---

## 📱 ساخت نسخه اندروید (APK)

یک پروژه آماده Android Studio در پوشه `android_project/` قرار دارد.

### مراحل خروجی گرفتن APK:
1. پوشه `android_project` را در **Android Studio** باز کنید (`Open Existing Project`).
2. منتظر بمانید تا Gradle پروژه را Sync کند.
3. از منوی بالا مسیر زیر را دنبال کنید:
   `Build` ➔ `Build Bundle(s) / APK(s)` ➔ `Build APK(s)`
4. فایل APK آماده در مسیر `app/build/outputs/apk/debug/app-debug.apk` ساخته خواهد شد.

---

## 📜 مجوز (License)

این پروژه تحت مجوز MIT منتشر شده است.
