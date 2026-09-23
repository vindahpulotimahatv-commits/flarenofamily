// -----------------------------------------------------------
// Tambahkan baris ini ke plugins{} di file build.gradle.kts
// PALING LUAR (root project, bukan yang di dalam folder app/):
// -----------------------------------------------------------

plugins {
    id("com.google.gms.google-services") version "4.4.2" apply false
}
