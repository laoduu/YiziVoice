// Linux 录音(麦克风)支持。
//
// 背景:wry 0.55 在 WebKitGTK 上只打开了 WebGL / WebAudio,既没有
// `set_enable_media_stream(true)`,也没有连接 `permission-request` 信号。
// 两件事缺任一都录不了音,且表现完全不同:
//   - 缺 enable_media_stream:`getUserMedia` 直接 reject(NotAllowedError),
//     页面连授权弹窗都等不到 —— 用户看到的就是「点了录音没反应」;
//   - 缺 permission-request 处理器:WebKit 的默认行为是静默 deny。
//
// 这里两件都补上:允许媒体流,并且只放行麦克风/摄像头的请求,
// 其余权限请求(地理位置、通知、插件安装…)一律 deny —— 本应用不需要它们,
// 而 WebKitGTK 没有「系统级授权弹窗」,放行即等于永久授权。
#![cfg(target_os = "linux")]

use tauri::Manager;
// 这个 crate 没有 prelude:gir 生成的 trait 直接在根部重导出
// (`pub use crate::auto::traits::*`),另需 glib 的 Cast/ObjectExt 做接口类型判断。
use webkit2gtk::glib::prelude::*;
use webkit2gtk::{PermissionRequestExt, SettingsExt, UserMediaPermissionRequest, WebViewExt};
/// 必须在事件循环跑起来之后再动 webview:`with_webview` 会把闭包投递到主线程
/// 并阻塞等待它执行完。在 `setup`(此时仍处于主线程、循环尚未启动)里同步调用
/// 会与自己的投递互等而死锁,所以改用后台线程等一小会儿再投递。
pub fn enable_media_capture(app: &tauri::AppHandle) {
    let Some(window) = app.get_webview_window("main") else {
        eprintln!("[YiziVoice] media capture: main webview not found");
        return;
    };

    std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_millis(400));
        let result = window.with_webview(|webview| {
            // inner() 返回 WebView 的克隆,不是引用
            let view = webview.inner();

            if let Some(settings) = view.settings() {
                settings.set_enable_media_stream(true);
                settings.set_enable_mediasource(true);
                settings.set_enable_webaudio(true);
            } else {
                eprintln!("[YiziVoice] media capture: webview settings unavailable");
            }

            // 返回 true = 请求已被处理(这里是自己 allow/deny),WebKit 不再走默认拒绝。
            view.connect_permission_request(|_, request| {
                if request.is::<UserMediaPermissionRequest>() {
                    request.allow();
                } else {
                    request.deny();
                }
                true
            });

            println!("[YiziVoice] media capture enabled (WebKitGTK media stream + permission handler)");
        });

        if let Err(e) = result {
            eprintln!("[YiziVoice] media capture setup failed: {e}");
        }
    });
}
