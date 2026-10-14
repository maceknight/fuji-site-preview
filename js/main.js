/* ============================================================
   FUJI co.,LTD. — 公開ページ用スクリプト
   ------------------------------------------------------------
   外部ライブラリは使わない。各機能は対象の要素が無いページでは
   何もしないようにしてある。
   ============================================================ */
(function () {
    'use strict';

    var ready = function (fn) {
        if (document.readyState !== 'loading') {
            fn();
        } else {
            document.addEventListener('DOMContentLoaded', fn);
        }
    };

    /* --------------------------------------------------------
       ヘッダー（スマートフォンのメニュー）
    -------------------------------------------------------- */
    function initNav() {
        var toggle = document.getElementById('navToggle');
        var drawer = document.getElementById('navDrawer');
        if (!toggle || !drawer) return;

        toggle.addEventListener('click', function () {
            var open = drawer.hasAttribute('hidden');
            if (open) {
                drawer.removeAttribute('hidden');
            } else {
                drawer.setAttribute('hidden', '');
            }
            toggle.classList.toggle('is-open', open);
            toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        });
    }

    /* --------------------------------------------------------
       製品ページ（カタログ）

       JavaScriptが受け持つのは次の3つ。
         ・商品ジャンルをその場で開く（別ページに飛ばさない）
         ・商品一覧の GRID / LIST 切替（選択は localStorage に残す）
         ・絞り込みの select を選んだら送信する
       いずれも無くて困らないようにしてある。ジャンルのカードは
       products.php?category=… へのリンクのままで、サーバ側も同じ
       ページをそのジャンルを開いた状態で返す。
    -------------------------------------------------------- */
    var VIEW_KEY = 'fuji.products.view';

    /* --------------------------------------------------------
       ジャンルをその場で開く

       パネルはカードと同じグリッドの子要素にしてあり、
       CSS の order だけで「押されたカードの行の直後」に移す。
       列数はブレークポイントで変わるので、その都度実際の
       grid-template-columns から数える。
    -------------------------------------------------------- */
    function initCategoryPanels() {
        var grid = document.querySelector('[data-category-grid]');
        if (!grid || !window.history || !window.history.pushState) return;

        var cards = Array.prototype.slice.call(grid.querySelectorAll('[data-category-card]'));
        var panels = Array.prototype.slice.call(grid.querySelectorAll('[data-category-panel]'));
        if (!cards.length || cards.length !== panels.length) return;

        var index = {};
        cards.forEach(function (card, i) { index[card.dataset.categoryCard] = i; });

        function columns() {
            var value = window.getComputedStyle(grid).gridTemplateColumns || '';
            var n = value.split(' ').filter(function (v) { return v !== ''; }).length;
            return n > 0 ? n : 1;
        }

        /* カードの order は i*2。行の最後のカードの直後に入れる */
        function place(panel, i) {
            var cols = columns();
            var lastInRow = (Math.floor(i / cols) + 1) * cols - 1;
            panel.style.order = String(lastInRow * 2 + 1);
        }

        function headerOffset() {
            var nav = document.querySelector('.site-nav');
            return (nav ? nav.getBoundingClientRect().height : 0) + 16;
        }

        var current = '';

        function apply(slug) {
            current = slug;
            cards.forEach(function (card) {
                var on = card.dataset.categoryCard === slug;
                card.classList.toggle('is-open', on);
                card.setAttribute('aria-expanded', on ? 'true' : 'false');
            });
            panels.forEach(function (panel) {
                var on = panel.dataset.categoryPanel === slug;
                panel.hidden = !on;
                if (on) place(panel, index[slug]);
            });
        }

        function open(slug, scroll) {
            if (!(slug in index)) return;
            apply(slug);
            var panel = panels[index[slug]];
            filterPanel(panel, '');
            if (scroll) {
                var top = panel.getBoundingClientRect().top + window.pageYOffset - headerOffset();
                window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
            }
        }

        function close(scroll) {
            var previous = current;
            apply('');
            if (scroll && previous && previous in index) {
                var card = cards[index[previous]];
                var top = card.getBoundingClientRect().top + window.pageYOffset - headerOffset();
                window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
            }
        }

        /* ---- パネルの中のブランド絞り込み（URLは変えない）---- */
        function filterPanel(panel, brand) {
            var rows = panel.querySelectorAll('[data-brand-slug]');
            var shown = 0;
            Array.prototype.forEach.call(rows, function (row) {
                var on = brand === '' || row.dataset.brandSlug === brand;
                row.hidden = !on;
                if (on && row.classList.contains('pl-cell')) shown++;
            });
            panel.querySelectorAll('.cx-brand').forEach(function (button) {
                var on = button.dataset.brand === brand;
                button.classList.toggle('is-active', on);
                button.setAttribute('aria-pressed', on ? 'true' : 'false');
            });
            var count = panel.querySelector('[data-product-count]');
            if (count) count.textContent = shown + (shown === 1 ? ' Product' : ' Products');
            var empty = panel.querySelector('[data-product-empty]');
            if (empty) empty.hidden = shown > 0;
        }

        /* ---- クリックを横取りする ---- */
        cards.forEach(function (card) {
            card.addEventListener('click', function (event) {
                /* 新しいタブで開きたい人の邪魔はしない */
                if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
                event.preventDefault();
                var slug = card.dataset.categoryCard;
                if (current === slug) {
                    close(true);
                    history.pushState({ category: '' }, '', 'products.php');
                } else {
                    open(slug, true);
                    history.pushState({ category: slug }, '', card.getAttribute('href'));
                }
            });
        });

        panels.forEach(function (panel) {
            var closeButton = panel.querySelector('[data-category-close]');
            if (closeButton) {
                closeButton.addEventListener('click', function () {
                    close(true);
                    history.pushState({ category: '' }, '', 'products.php');
                });
            }
            panel.querySelectorAll('.cx-brand').forEach(function (button) {
                button.addEventListener('click', function () {
                    filterPanel(panel, button.dataset.brand);
                });
            });
        });

        /* ---- 戻る・進むで開閉を合わせる ---- */
        window.addEventListener('popstate', function () {
            var params = new URLSearchParams(window.location.search);
            var slug = params.get('category') || '';
            if (!(slug in index)) { apply(''); return; }
            apply(slug);
            var panel = panels[index[slug]];
            var brand = params.get('brand') || '';
            if (brand && !panel.querySelector('.cx-brand[data-brand="' + brand + '"]')) brand = '';
            filterPanel(panel, brand);
        });

        window.addEventListener('resize', function () {
            if (current && current in index) place(panels[index[current]], index[current]);
        });

        /* ---- サーバが開いた状態で返してきたとき ---- */
        var initial = '';
        cards.forEach(function (card) {
            if (card.getAttribute('aria-expanded') === 'true') initial = card.dataset.categoryCard;
        });
        if (initial) {
            current = initial;
            place(panels[index[initial]], index[initial]);
            return;
        }

        /* ---- URLに ?category= があるのに、開いた状態で届かなかったとき ----
           PHPのサーバーなら上で済むが、静的なコピー（見た目確認用）では
           サーバーが開けないので、ここで開く。&brand= も同じく反映する。 */
        var params = new URLSearchParams(window.location.search);
        var fromUrl = params.get('category') || '';
        if (fromUrl in index) {
            apply(fromUrl);
            var panel = panels[index[fromUrl]];
            var brand = params.get('brand') || '';
            if (brand && !panel.querySelector('.cx-brand[data-brand="' + brand + '"]')) brand = '';
            filterPanel(panel, brand);
        }
    }

    function initCatalog() {
        var page = document.getElementById('productsPage');
        if (!page) return;

        /* ---- GRID / LIST ---- */
        var lists = Array.prototype.slice.call(page.querySelectorAll('[data-product-list]'));

        function setView(view) {
            lists.forEach(function (list) {
                var grid = list.querySelector('[data-view-grid]');
                var table = list.querySelector('[data-view-list]');
                if (grid) grid.hidden = view === 'list';
                if (table) table.hidden = view !== 'list';
                list.querySelectorAll('.pl-view-btn').forEach(function (button) {
                    button.classList.toggle('is-active', button.dataset.view === view);
                });
            });
            try { window.localStorage.setItem(VIEW_KEY, view); } catch (e) {}
        }

        if (lists.length) {
            page.querySelectorAll('.pl-view-btn').forEach(function (button) {
                button.addEventListener('click', function () { setView(button.dataset.view); });
            });
            var saved = null;
            try { saved = window.localStorage.getItem(VIEW_KEY); } catch (e) {}
            setView(saved === 'list' ? 'list' : 'grid');
        }

        /* ---- 絞り込みは選んだ時点で送信する ---- */
        page.querySelectorAll('select[data-autosubmit]').forEach(function (select) {
            select.addEventListener('change', function () {
                var form = select.closest('form');
                if (form) form.submit();
            });
        });
    }

    /* --------------------------------------------------------
       商品名の自動長体（横方向の圧縮表示）

       商品名タグ（.product-name-sm／.scroll-label）が見切れる場合だけ、
       内側の span に scaleX をかけて縮める。100%→90%→…→60% の
       10%刻みで収まる最大の段階を採用し、60%でも収まらないものは
       末尾を「…」に置き換える（仕様書 第1部2-3 の改善要望）。
       ※ scaleX をかける要素と幅を固定して切り取る要素は必ず分ける。
         同じ要素に両方かけると、縮小前の幅で先に切られてしまう。
    -------------------------------------------------------- */
    var NAME_FIT_STEPS = [0.9, 0.8, 0.7, 0.6];

    function fitName(el) {
        var inner = el.querySelector(':scope > .name-fit-inner');
        if (!inner) {
            inner = document.createElement('span');
            inner.className = 'name-fit-inner';
            while (el.firstChild) inner.appendChild(el.firstChild);
            el.appendChild(inner);
        }
        if (!inner.dataset.full) {
            inner.dataset.full = inner.textContent;
        }
        inner.textContent = inner.dataset.full;
        inner.style.transform = 'none';
        inner.style.marginLeft = '0px';

        var boxWidth = el.clientWidth;
        if (!boxWidth) return;

        var contentWidth = inner.scrollWidth;
        var scale = 1;

        if (contentWidth > boxWidth) {
            var ratio = boxWidth / contentWidth;
            scale = NAME_FIT_STEPS[NAME_FIT_STEPS.length - 1];
            for (var i = 0; i < NAME_FIT_STEPS.length; i++) {
                if (NAME_FIT_STEPS[i] <= ratio) { scale = NAME_FIT_STEPS[i]; break; }
            }
            inner.style.transformOrigin = 'left center';
            inner.style.transform = 'scaleX(' + scale + ')';

            // 下限の60%でも収まらない場合は末尾を省略する
            if (contentWidth * scale > boxWidth) {
                var text = inner.dataset.full;
                while (text.length > 1 && inner.scrollWidth * scale > boxWidth) {
                    text = text.slice(0, -1);
                    inner.textContent = text + '…';
                }
                el.title = inner.dataset.full;
            }
            contentWidth = inner.scrollWidth;
        }

        // 中央寄せは text-align に頼らず計算する（scaleX と併用すると左へずれるため）
        var visibleWidth = contentWidth * scale;
        inner.style.marginLeft = Math.max(0, Math.round((boxWidth - visibleWidth) / 2)) + 'px';
    }

    function fitNamesWithin(container) {
        container.querySelectorAll('.product-name-sm, .scroll-label').forEach(fitName);
    }

    function initNameFit() {
        if (!document.querySelector('.product-name-sm, .scroll-label')) return;

        if ('ResizeObserver' in window) {
            var observer = new ResizeObserver(function (entries) {
                entries.forEach(function (entry) { fitNamesWithin(entry.target); });
            });
            document.querySelectorAll('.product-card, .scroll-item').forEach(function (card) {
                observer.observe(card);
            });
        } else {
            var timer = null;
            window.addEventListener('resize', function () {
                window.clearTimeout(timer);
                timer = window.setTimeout(function () { fitNamesWithin(document); }, 150);
            });
        }

        window.addEventListener('load', function () { fitNamesWithin(document); });
        if (document.fonts && document.fonts.ready) {
            document.fonts.ready.then(function () { fitNamesWithin(document); });
        }
    }

    /* --------------------------------------------------------
       お知らせモーダル
       data-body が空の項目は、リンクがあればそちらへ遷移する。
    -------------------------------------------------------- */
    function initNewsModal() {
        var bg = document.getElementById('newsModalBg');
        if (!bg) return;

        var elDate  = document.getElementById('newsModalDate');
        var elTag   = document.getElementById('newsModalTag');
        var elTitle = document.getElementById('newsModalTitle');
        var elBody  = document.getElementById('newsModalBody');
        var elLink  = document.getElementById('newsModalLink');
        var elClose = document.getElementById('newsModalClose');

        function close() { bg.classList.remove('open'); }

        function open(item) {
            var body = item.dataset.body || '';
            var link = item.dataset.link || '';
            if (!body) {
                if (link) window.open(link, '_blank', 'noopener');
                return;
            }
            elDate.textContent  = item.dataset.date || '';
            elTag.textContent   = item.dataset.tag || '';
            elTitle.textContent = item.dataset.title || '';
            elBody.textContent  = body;
            if (link) {
                elLink.href = link;
                elLink.removeAttribute('hidden');
            } else {
                elLink.setAttribute('hidden', '');
            }
            bg.classList.add('open');
        }

        document.querySelectorAll('.hero-news-item, .about-news-item').forEach(function (item) {
            item.addEventListener('click', function () { open(item); });
            item.addEventListener('keydown', function (e) {
                if (e.key === 'Enter') open(item);
            });
        });

        elClose.addEventListener('click', close);
        bg.addEventListener('click', function (e) { if (e.target === bg) close(); });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') close();
        });
    }

    /* --------------------------------------------------------
       商品詳細：メイン画像の切替とサブ画像の送り
       サブ画像が6枚以上あるときだけ ◀▶ を出し、10秒放置でも送る。
    -------------------------------------------------------- */
    var THUMB_STEP = 5;
    var IDLE_MS = 10000;

    function initGallery() {
        var main = document.getElementById('pdMainImg');
        if (!main) return;

        var mainImg = main.querySelector('img');
        var thumbs = Array.prototype.slice.call(document.querySelectorAll('.pd-gallery-thumb'));

        thumbs.forEach(function (thumb, index) {
            thumb.addEventListener('click', function () {
                thumbs.forEach(function (t) { t.classList.remove('active'); });
                thumb.classList.add('active');
                if (mainImg && thumb.dataset.full) {
                    mainImg.src = thumb.dataset.full;
                    mainImg.alt = thumb.dataset.alt || mainImg.alt;
                }
                // 2枚目以降は撮影が異なり寸法線の座標が合わないため、マーカーは隠す
                window.pdMainImgIsTop = index === 0;
                updateSizeMarkers();
            });
        });

        initScroller(document.querySelector('.pd-gallery-thumbs-wrap'), '.pd-gallery-thumbs', THUMB_STEP, 80);
    }

    /**
     * 横スクロール領域に ◀▶ と放置送りを付ける共通処理。
     * @param {Element} wrap    ボタンを含む外枠
     * @param {string}  sel     スクロールする要素のセレクタ
     * @param {number}  step    1回で送る件数
     * @param {number}  itemW   1件あたりの幅(px)
     */
    function initScroller(wrap, sel, step, itemW) {
        if (!wrap) return;
        var scroller = wrap.querySelector(sel);
        var prev = wrap.querySelector('.pd-scroll-btn--prev');
        var next = wrap.querySelector('.pd-scroll-btn--next');
        if (!scroller) return;

        function amount() { return itemW * step; }
        function max() { return scroller.scrollWidth - scroller.clientWidth; }

        if (prev) prev.addEventListener('click', function () {
            scroller.scrollBy({ left: -amount(), behavior: 'smooth' });
            restartIdle();
        });
        if (next) next.addEventListener('click', function () {
            scroller.scrollBy({ left: amount(), behavior: 'smooth' });
            restartIdle();
        });

        var idleTimer = null;
        function tick() {
            if (max() <= 0) return;
            var left = scroller.scrollLeft + amount();
            scroller.scrollTo({ left: left > max() ? 0 : left, behavior: 'smooth' });
        }
        function restartIdle() {
            window.clearInterval(idleTimer);
            idleTimer = window.setInterval(tick, IDLE_MS);
        }
        scroller.addEventListener('mouseenter', function () { window.clearInterval(idleTimer); });
        scroller.addEventListener('mouseleave', restartIdle);
        restartIdle();
    }

    /* --------------------------------------------------------
       商品詳細：ラインナップの「詳しく見る」と寸法線
    -------------------------------------------------------- */
    window.pdMainImgIsTop = true;
    var sizeDetailExpanded = false;

    function updateSizeMarkers() {
        var main = document.getElementById('pdMainImg');
        if (!main) return;
        main.classList.toggle('pd-show-size-markers', sizeDetailExpanded && window.pdMainImgIsTop);
    }

    function initLineupToggle() {
        var btn = document.getElementById('pdSizeToggle');
        var wrap = document.getElementById('pdSizeTableWrap');
        if (!btn || !wrap) return;

        btn.addEventListener('click', function () {
            sizeDetailExpanded = wrap.classList.toggle('pd-size-table-expanded');
            btn.textContent = sizeDetailExpanded ? '閉じる' : '詳しく見る';
            btn.setAttribute('aria-expanded', sizeDetailExpanded ? 'true' : 'false');
            updateSizeMarkers();
        });
    }

    /* --------------------------------------------------------
       商品詳細：タブ（関連商品）
    -------------------------------------------------------- */
    function initTabs() {
        var bar = document.querySelector('.pd-tab-bar');
        if (!bar) return;
        bar.querySelectorAll('.pd-tab').forEach(function (tab) {
            tab.addEventListener('click', function () {
                bar.querySelectorAll('.pd-tab').forEach(function (t) { t.classList.remove('active'); });
                document.querySelectorAll('.pd-tab-panel').forEach(function (p) { p.classList.remove('active'); });
                tab.classList.add('active');
                var panel = document.getElementById(tab.dataset.panel);
                if (panel) panel.classList.add('active');
            });
        });
    }

    /* --------------------------------------------------------
       商品詳細：バリエーションの拡大表示（ページ遷移しない）
    -------------------------------------------------------- */
    var openLightbox = function () {};

    function initLightbox() {
        var box = document.getElementById('pdLightbox');
        if (!box) return;

        var img    = document.getElementById('pdLightboxImg');
        var swatch = document.getElementById('pdLightboxSwatch');
        var label  = document.getElementById('pdLightboxLabel');

        // バリエーションのアプリ版（initPicker）からも使う
        openLightbox = function (src, color, text) {
            if (src) {
                img.src = src;
                img.alt = text || '';
                img.removeAttribute('hidden');
                swatch.setAttribute('hidden', '');
            } else {
                img.setAttribute('hidden', '');
                swatch.style.background = color || 'var(--fog)';
                swatch.removeAttribute('hidden');
            }
            label.textContent = text || '';
            box.classList.add('is-open');
            box.setAttribute('aria-hidden', 'false');
        };

        document.querySelectorAll('.pd-lightbox-trigger').forEach(function (btn) {
            btn.addEventListener('click', function () {
                openLightbox(btn.dataset.img || '', btn.dataset.color, btn.dataset.label);
            });
        });

        function close() {
            box.classList.remove('is-open');
            box.setAttribute('aria-hidden', 'true');
        }
        box.querySelectorAll('[data-close]').forEach(function (el) {
            el.addEventListener('click', close);
        });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') close();
        });
    }

    /* --------------------------------------------------------
       商品詳細：バリエーションのアプリ版（A案(2)）
       components/variation-picker.php の動き。
         ・見出しの切り替えで A案(1)（一覧）と行き来する。選んだ方は覚えておく
         ・タップで選ぶ。写真があれば左のメイン画像を差し替える
         ・生地を選ぶと、その生地の色の段を出す
         ・丸型の型番でしか選べない項目は、角型の型番を選ぶと灰色にする
         ・ダブルクリックで拡大。生地は生地ページへ
    -------------------------------------------------------- */
    var PICKER_KEY = 'fuji.variationMode';

    function initPicker() {
        var picker = document.getElementById('pdPicker');
        var list = document.getElementById('pdVariationWrap');
        var switcher = document.querySelector('.pva-switch');
        if (!picker || !list || !switcher) return;

        var main = document.getElementById('pdMainImg');
        var mainImg = main ? main.querySelector('img') : null;
        var original = mainImg ? { src: mainImg.src, alt: mainImg.alt } : null;
        var summary = document.getElementById('pdPickerSummary');
        var summaryDefault = summary ? summary.textContent : '';
        var steps = Array.prototype.slice.call(picker.querySelectorAll('.pva-step'));

        function setMode(mode) {
            var app = mode === '2';
            picker.hidden = !app;
            list.hidden = app;
            switcher.querySelectorAll('button').forEach(function (b) {
                b.setAttribute('aria-pressed', b.dataset.mode === mode ? 'true' : 'false');
            });
            if (!app) restoreMain();
            try { localStorage.setItem(PICKER_KEY, mode); } catch (e) {}
        }
        switcher.querySelectorAll('button').forEach(function (b) {
            b.addEventListener('click', function () { setMode(b.dataset.mode); });
        });
        try { if (localStorage.getItem(PICKER_KEY) === '2') setMode('2'); } catch (e) {}

        function showOnMain(src, alt) {
            if (!mainImg || !src) return;
            mainImg.src = src;
            mainImg.alt = alt || '';
            main.classList.add('pva-variant');
            // 寸法線は1枚目の写真に合わせた座標なので、差し替え中は隠す
            window.pdMainImgIsTop = false;
            updateSizeMarkers();
        }
        function restoreMain() {
            if (!mainImg || !original || !main.classList.contains('pva-variant')) return;
            mainImg.src = original.src;
            mainImg.alt = original.alt;
            main.classList.remove('pva-variant');
            window.pdMainImgIsTop = true;
            updateSizeMarkers();
        }

        function selected(step) { return step.querySelector('.pva-opt[aria-pressed="true"]'); }

        function updateSummary() {
            if (!summary) return;
            var picks = [];
            steps.forEach(function (step) {
                if (step.hidden) return;
                var opt = selected(step);
                if (opt) picks.push(opt.dataset.label);
            });
            summary.textContent = picks.length ? '選択中：' + picks.join(' ／ ') : summaryDefault;
        }

        // 型番の形に合わない項目を灰色にする（選んでいたら外す）
        function applyShape() {
            var lineup = picker.querySelector('.pva-opt[data-kind="lineup"][aria-pressed="true"]');
            var shape = lineup ? lineup.dataset.shape : '';
            picker.querySelectorAll('.pva-opt[data-requires]').forEach(function (opt) {
                var ok = !shape || opt.dataset.requires === shape;
                opt.disabled = !ok;
                opt.title = ok ? '' : 'この型番では選べません';
                if (!ok) opt.setAttribute('aria-pressed', 'false');
            });
        }

        function showFabric(fabricId) {
            picker.querySelectorAll('.pva-step--colors').forEach(function (step) {
                var show = step.dataset.forFabric === fabricId;
                if (!show) {
                    step.querySelectorAll('.pva-opt').forEach(function (o) { o.setAttribute('aria-pressed', 'false'); });
                }
                step.hidden = !show;
            });
        }

        picker.querySelectorAll('.pva-opt').forEach(function (opt) {
            opt.setAttribute('aria-pressed', 'false');
            opt.addEventListener('click', function () {
                if (opt.disabled) return;
                var step = opt.closest('.pva-step');
                step.querySelectorAll('.pva-opt').forEach(function (o) { o.setAttribute('aria-pressed', 'false'); });
                opt.setAttribute('aria-pressed', 'true');

                if (opt.dataset.kind === 'lineup') applyShape();
                if (opt.dataset.kind === 'fabric') showFabric(opt.dataset.fabric || '');
                if (opt.dataset.img) showOnMain(opt.dataset.img, opt.dataset.label);
                updateSummary();
            });
            opt.addEventListener('dblclick', function () {
                if (opt.disabled) return;
                if (opt.dataset.kind === 'fabric') {
                    if (opt.dataset.href) window.location.href = opt.dataset.href;
                    return;
                }
                if (opt.dataset.img || opt.dataset.color) {
                    openLightbox(opt.dataset.img, opt.dataset.color, opt.dataset.label);
                }
            });
        });

        var reset = document.getElementById('pdPickerReset');
        if (reset) reset.addEventListener('click', function () {
            picker.querySelectorAll('.pva-opt').forEach(function (o) { o.setAttribute('aria-pressed', 'false'); });
            showFabric(null);
            applyShape();
            restoreMain();
            updateSummary();
        });
    }

    /* --------------------------------------------------------
       関連商品の横送り（4件以上のとき）
    -------------------------------------------------------- */
    function initRelated() {
        initScroller(document.querySelector('.pd-related-wrap'), '.pd-related-scroll', 3, 176);
    }

    /* --------------------------------------------------------
       会社情報：セクションのサブナビ
    -------------------------------------------------------- */
    function initAboutSubnav() {
        var items = Array.prototype.slice.call(document.querySelectorAll('.about-subnav-item'));
        if (!items.length) return;

        var sections = items.map(function (item) {
            return document.querySelector(item.getAttribute('href'));
        });

        window.addEventListener('scroll', function () {
            var pos = window.scrollY + 140;
            var current = 0;
            sections.forEach(function (section, i) {
                if (section && section.offsetTop <= pos) current = i;
            });
            items.forEach(function (item, i) {
                item.classList.toggle('active', i === current);
            });
        }, { passive: true });
    }

    /* --------------------------------------------------------
       商品のクイックビュー

       一覧で商品を押したとき、商品詳細ページへ遷移する代わりに
       画面中央のモーダルへ product-quickview.php を読み込んで出す。
       いちいち戻らずに次の商品を見られるようにするため。

       ・中身のHTMLはPHP側で作る（価格や供給区分の表記をJSで作り直さない）
       ・URLは商品詳細ページのものに差し替える。だから共有もできるし、
         戻るボタンで閉じる。再読み込みすれば普通の商品詳細ページが出る
       ・リンクはそのまま残してあるので、JSが無ければ今までどおり遷移する
    -------------------------------------------------------- */
    function initQuickview() {
        var bg = document.getElementById('quickviewBg');
        var body = document.getElementById('quickviewBody');
        var closeButton = document.getElementById('quickviewClose');
        if (!bg || !body || !window.history || !window.history.pushState) return;
        /* 商品詳細ページ自身では使わない。そこの関連商品は普通に遷移させる
           （モーダルのURLと現在地のURLが同じ形になって、戻るの扱いが怪しくなるため） */
        if (/\/product-\d+\.html$/.test(location.pathname)) return;

        var dialog = bg.querySelector('.qv');
        var cache = {};
        var baseUrl = location.pathname + location.search;
        var lastFocus = null;
        var currentId = '';

        function idFromHref(href) {
            if (!href) return '';
            var m = href.match(/(?:^|\/)product-(\d+)\.html/);
            return m ? m[1] : '';
        }

        function setView(html) {
            body.innerHTML = html;
            dialog.setAttribute('aria-busy', 'false');
            /* サブ画像の切り替え。差し込んだ直後の要素に付ける */
            var main = body.querySelector('#qvMainImage');
            body.querySelectorAll('.qv-thumb').forEach(function (thumb) {
                thumb.addEventListener('click', function () {
                    if (!main) return;
                    main.src = thumb.dataset.full;
                    main.alt = thumb.dataset.alt || '';
                    body.querySelectorAll('.qv-thumb').forEach(function (t) {
                        t.classList.toggle('is-active', t === thumb);
                    });
                });
            });
        }

        function open(id, trigger) {
            currentId = id;
            lastFocus = trigger || null;
            dialog.setAttribute('aria-busy', 'true');
            body.innerHTML = '';
            bg.hidden = false;
            document.body.classList.add('qv-locked');
            /* hidden を外した直後だと transition が効かないので1フレーム待つ */
            requestAnimationFrame(function () { bg.classList.add('is-open'); });
            closeButton.focus();

            if (cache[id]) {
                setView(cache[id]);
                return;
            }
            fetch('qv-' + encodeURIComponent(id) + '.html', { credentials: 'same-origin' })
                .then(function (res) { return res.text(); })
                .then(function (html) {
                    cache[id] = html;
                    if (currentId === id) setView(html);
                })
                .catch(function () {
                    if (currentId === id) {
                        setView('<div class="qv-missing"><p>読み込めませんでした。'
                              + '<a href="product-' + encodeURIComponent(id) + '.html">商品ページを開く</a></p></div>');
                    }
                });
        }

        function close() {
            if (bg.hidden) return;
            currentId = '';
            bg.classList.remove('is-open');
            document.body.classList.remove('qv-locked');
            window.setTimeout(function () {
                if (!bg.classList.contains('is-open')) {
                    bg.hidden = true;
                    body.innerHTML = '';
                }
            }, 200);
            if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
            lastFocus = null;
        }

        /* ---- 一覧などの商品リンクを横取りする ---- */
        document.addEventListener('click', function (event) {
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
            var link = event.target.closest ? event.target.closest('a[href^="product-"]') : null;
            if (!link || link.hasAttribute('data-no-quickview') || link.target === '_blank') return;
            var id = idFromHref(link.getAttribute('href'));
            if (!id) return;
            event.preventDefault();
            baseUrl = location.pathname + location.search;
            open(id, link);
            history.pushState({ quickview: id }, '', link.getAttribute('href'));
        });

        closeButton.addEventListener('click', function () {
            close();
            history.pushState({ quickview: '' }, '', baseUrl);
        });

        /* 背景の暗いところを押したら閉じる（中身の上では閉じない） */
        bg.addEventListener('click', function (event) {
            if (event.target !== bg) return;
            close();
            history.pushState({ quickview: '' }, '', baseUrl);
        });

        document.addEventListener('keydown', function (event) {
            if (bg.hidden) return;
            if (event.key === 'Escape') {
                close();
                history.pushState({ quickview: '' }, '', baseUrl);
                return;
            }
            /* モーダルの外へフォーカスが出ていかないようにする */
            if (event.key !== 'Tab') return;
            var focusable = dialog.querySelectorAll('a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])');
            if (!focusable.length) return;
            var first = focusable[0];
            var last = focusable[focusable.length - 1];
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault(); last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault(); first.focus();
            }
        });

        window.addEventListener('popstate', function () {
            var id = idFromHref(location.pathname + location.search);
            if (id) { open(id, null); } else { close(); }
        });
    }

    ready(function () {
        initNav();
        initQuickview();
        initCategoryPanels();
        initCatalog();
        initNameFit();
        initNewsModal();
        initGallery();
        initLineupToggle();
        initTabs();
        initLightbox();
        initPicker();
        initRelated();
        initAboutSubnav();
    });
})();
