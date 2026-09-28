// 効果音の管理
// 音源：効果音ラボ（https://soundeffect-lab.info/）
// 利用規約により効果音ファイルへの直リンクは禁止のため、sound/ フォルダにダウンロードして使用している
const SoundManager = (function() {
    // 名前: [ファイル, 音量(0〜1)]
    const SOUNDS = {
        start:     ['sound/start.mp3',     0.6], // オープニングでモードを選ぶ（決定ボタンを押す18）
        tab:       ['sound/tab.mp3',       0.5], // ゲーム中のモード切替（決定ボタンを押す22）
        select:    ['sound/select.mp3',    0.4], // ピースを押す（カーソル移動7）
        swap:      ['sound/swap.mp3',      0.5], // ピースを入れ替える（カーソル移動9）
        clear:     ['sound/clear.mp3',     0.5], // ピースが消える（キラッ1）
        combo:     ['sound/combo.mp3',     0.5], // 2コンボ以上（シャキーン3）
        perfect:   ['sound/perfect.mp3',   0.6], // 11コンボ以上のPERFECT（ジャジャーン）
        fever:     ['sound/fever.mp3',     0.6], // フィーバータイム突入（決定ボタンを押す10）
        countdown: ['sound/countdown.mp3', 0.5], // タイムモード残り5秒（カーソル移動6）
        gameover:  ['sound/gameover.mp3',  0.5], // GAME OVER（試合終了のゴング）
        highscore: ['sound/highscore.mp3', 0.6], // ハイスコア登録（レベルアップ）
        ok:        ['sound/ok.mp3',        0.5], // 名前入力のOK（決定ボタンを押す1）
        cancel:    ['sound/cancel.mp3',    0.5]  // 名前入力のキャンセル（キャンセル6）
    };

    // 起動時に読み込んでおく（再生時は複製して鳴らすので、同じ音が重なっても途切れない）
    const sources = {};
    for (const [name, [src]] of Object.entries(SOUNDS)) {
        const audio = new Audio(src);
        audio.preload = 'auto';
        sources[name] = audio;
    }

    /**
     * 効果音を鳴らす
     * @param {string} name SOUNDS のキー
     * @param {{rate?: number}} [options] rate: 再生速度（1より大きいと高い音になる）
     */
    function play(name, options = {}) {
        const source = sources[name];
        if (!source) return;
        const audio = source.cloneNode();
        audio.volume = SOUNDS[name][1];
        if (options.rate) {
            audio.preservesPitch = false; // 速度に合わせて音程も上げる
            audio.playbackRate = options.rate;
        }
        // ブラウザの自動再生制限などで再生できなくてもゲームは止めない
        audio.play().catch(() => {});
    }

    return { play };
})();

window.SoundManager = SoundManager;

// BGM の管理
// 音源：OpenTracks（旧DOVA-SYNDROME / https://opentracks.com/）
//   opening: 「8bit Game Menu」 by スエノブ
//   game:    「おさかなシャトル - 8bit」 by Hupple
//   fever:   「ドードドド・スタンピード」 by MAKOOTO
// 音源利用ライセンスにより mp3 のままの同梱は禁止のため、ogg / m4a に変換して bgm/ に置いている
const BgmManager = (function() {
    const VOLUME = 0.35;
    const FADE_MS = 400;
    const TRACKS = ['opening', 'game', 'fever'];

    // ogg が再生できないブラウザ（古い Safari など）は m4a を使う
    const ext = new Audio().canPlayType('audio/ogg; codecs="vorbis"') ? 'ogg' : 'm4a';
    const audios = {};
    for (const name of TRACKS) {
        const audio = new Audio(`bgm/${name}.${ext}`);
        audio.loop = true;
        audio.preload = 'auto';
        audio.volume = 0;
        audios[name] = audio;
    }

    let current = null; // 再生中（または再生したい）曲名。null なら無音
    const fadeTimers = {};

    function fade(audio, to, onDone) {
        clearInterval(fadeTimers[audio.src]);
        const from = audio.volume;
        const start = Date.now();
        fadeTimers[audio.src] = setInterval(() => {
            const t = Math.min((Date.now() - start) / FADE_MS, 1);
            audio.volume = from + (to - from) * t;
            if (t >= 1) {
                clearInterval(fadeTimers[audio.src]);
                if (onDone) onDone();
            }
        }, 30);
    }

    function startCurrent() {
        if (!current) return;
        const audio = audios[current];
        // ブラウザはユーザー操作前の自動再生を禁止しているので、失敗しても最初の操作時に再開する
        audio.play().then(() => fade(audio, VOLUME)).catch(() => {});
    }

    /**
     * 流す曲を切り替える（同じ曲なら何もしない）
     * @param {string|null} name TRACKS のいずれか。null なら止める
     */
    function setTrack(name) {
        if (name === current) return;
        const prev = current;
        current = name;

        if (prev) {
            const prevAudio = audios[prev];
            fade(prevAudio, 0, () => prevAudio.pause());
        }
        if (!name) return;

        // すぐに戻ってきた場合、フェードアウト完了時の pause() で止まらないよう取り消す
        clearInterval(fadeTimers[audios[name].src]);

        // フィーバー明けはゲーム曲を続きから、それ以外は頭から流す
        if (!(prev === 'fever' && name === 'game')) {
            audios[name].currentTime = 0;
        }
        startCurrent();
    }

    // 自動再生が止められていた場合に備え、最初の操作で再生を開始する
    function resumeOnInteraction() {
        if (current && audios[current].paused) startCurrent();
    }
    window.addEventListener('pointerdown', resumeOnInteraction);
    window.addEventListener('keydown', resumeOnInteraction);

    return { setTrack };
})();

window.BgmManager = BgmManager;
