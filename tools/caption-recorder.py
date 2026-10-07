# -*- coding: utf-8 -*-
"""把 Windows「即時輔助字幕」(LiveCaptions.exe) 的文字每秒讀一次，完整存成文字檔。
用法：先按 Win+Ctrl+L 打開即時輔助字幕，再執行「字幕記錄.bat」。按 Ctrl+C 或關掉視窗停止。
存檔位置：data\\captions\\字幕_YYYYMMDD_HHMM.txt（每秒覆寫一次，隨時中斷也不會掉資料）。
"""
import os, sys, time, datetime

try:
    import uiautomation as auto
except ImportError:
    print("缺少 uiautomation 套件，請用「字幕記錄.bat」啟動（它會自動安裝）。")
    input("按 Enter 結束")
    sys.exit(1)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "data", "captions")
os.makedirs(OUT_DIR, exist_ok=True)
start = datetime.datetime.now()
out_path = os.path.join(OUT_DIR, start.strftime("字幕_%Y%m%d_%H%M.txt"))


def find_caption_text():
    """回傳字幕文字控制項；找不到回傳 None。"""
    win = auto.WindowControl(searchDepth=1, ClassName="LiveCaptionsDesktopWindow")
    if not win.Exists(0.5, 0.1):
        win = None
        for w in auto.GetRootControl().GetChildren():
            try:
                name = w.Name or ""
            except Exception:
                continue
            if "字幕" in name or "Live captions" in name or "LiveCaptions" in (w.ClassName or ""):
                win = w
                break
        if win is None:
            return None
    ctl = win.TextControl(searchDepth=10, AutomationId="CaptionsTextBlock")
    if ctl.Exists(0.5, 0.1):
        return ctl
    return None


def merge(transcript, buf):
    """字幕視窗只顯示最近一段且會往上捲；把新畫面接到完整逐字稿後面。"""
    buf = buf.strip()
    if not buf:
        return transcript
    if not transcript:
        return buf
    tail_start = max(0, len(transcript) - 4000)
    # 用畫面開頭一小段當錨點，找它在逐字稿尾端出現的位置
    for anchor_len in (24, 16, 10, 6):
        if len(buf) < anchor_len:
            continue
        anchor = buf[:anchor_len]
        idx = transcript.rfind(anchor, tail_start)
        if idx != -1:
            return transcript[:idx] + buf
    # 找不到錨點（例如捲太快或暫停很久）：當成新段落接上
    return transcript + "\n" + buf


def save(text):
    header = "# 即時輔助字幕紀錄　開始：%s　最後更新：%s\n\n" % (
        start.strftime("%Y-%m-%d %H:%M"), datetime.datetime.now().strftime("%H:%M:%S"))
    tmp = out_path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        f.write(header + text + "\n")
    os.replace(tmp, out_path)


def main():
    print("字幕記錄中…存到：", out_path)
    print("（請確認已按 Win+Ctrl+L 打開即時輔助字幕；按 Ctrl+C 停止）\n")
    transcript, last_buf, ctl, warned = "", "", None, False
    while True:
        try:
            if ctl is None:
                ctl = find_caption_text()
                if ctl is None:
                    if not warned:
                        print("找不到即時輔助字幕視窗，請按 Win+Ctrl+L 打開，我會持續等待…")
                        warned = True
                    time.sleep(2)
                    continue
                if warned:
                    print("找到字幕視窗了，開始記錄。")
                warned = False
            buf = ctl.Name or ""
            if buf != last_buf:
                last_buf = buf
                new = merge(transcript, buf)
                if new != transcript:
                    transcript = new
                    save(transcript)
                    last_line = transcript.strip().splitlines()[-1] if transcript.strip() else ""
                    print("\r" + last_line[-60:].ljust(60), end="", flush=True)
        except KeyboardInterrupt:
            break
        except Exception:
            ctl = None  # 視窗被關掉或重開，重新尋找
        time.sleep(1)
    if transcript:
        save(transcript)
    print("\n\n已停止。檔案：", out_path)


if __name__ == "__main__":
    main()
