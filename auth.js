/**
 * Local-only Auth Module
 */

export async function signInWithGoogle() {
    console.log("Auth removed: App is now local-only.");
}

export async function signInWithGooglePopup() {
    console.log("Auth removed: App is now local-only.");
}

export async function logoutUser() {
    if (confirm("This will clear your local data and reset the app. Continue?")) {
        localStorage.removeItem('firecalc_data');
        localStorage.removeItem('firecalc_app_version');
        localStorage.removeItem('firecalc_guest_mode');
        window.location.reload();
    }
}
