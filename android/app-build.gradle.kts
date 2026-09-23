// -----------------------------------------------------------
// Ini ISI yang perlu kamu TAMBAHKAN ke file app/build.gradle.kts
// bawaan Android Studio (jangan hapus semua isinya, gabungkan
// bagian di bawah ini ke plugins{} dan dependencies{} yang sudah
// ada, plus tambahkan blok android { buildFeatures { viewBinding = true } }).
// -----------------------------------------------------------

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("com.google.gms.google-services") // wajib untuk Firebase
}

android {
    namespace = "com.keluarga.misiharian"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.keluarga.misiharian"
        minSdk = 24
        targetSdk = 34
        versionCode = 1
        versionName = "1.0"
    }

    buildFeatures {
        viewBinding = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("com.google.android.material:material:1.12.0")
    implementation("androidx.constraintlayout:constraintlayout:2.1.4")
    implementation("androidx.recyclerview:recyclerview:1.3.2")
    implementation("androidx.activity:activity-ktx:1.9.0")

    // Firebase (pakai BoM biar versi semua modul otomatis cocok)
    implementation(platform("com.google.firebase:firebase-bom:33.1.2"))
    implementation("com.google.firebase:firebase-auth-ktx")
    implementation("com.google.firebase:firebase-firestore-ktx")

    // Upload foto ke ImgBB
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
}
