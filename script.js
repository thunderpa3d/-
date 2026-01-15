'use strict';

// ========== تهيئة التطبيق ==========
const SmartContactApp = (() => {
    // كلمة المرور الافتراضية
    const DEFAULT_PASSWORD = "60602025";
    
    // تكوين التطبيق
    const CONFIG = {
        dataSources: [
            {
                name: 'مصدر البيانات الرئيسي',
                url: 'https://raw.githubusercontent.com/thunderpa3d/-/main/CONTACTS.xlsx',
                proxy: true
            },
            {
                name: 'مصدر البيانات الاحتياطي',
                url: 'https://raw.githubusercontent.com/thunderpa3d/-/main/contacts.xlsx',
                proxy: true
            }
        ],
        syncInterval: 5 * 60 * 1000, // 5 دقائق
        maxRetries: 2,
        retryDelay: 2000,
        cacheTimeout: 10 * 60 * 1000, // 10 دقائق
        version: '2026.2.0'
    };

    // حالة التطبيق
    let state = {
        contacts: [],
        filteredContacts: [],
        isLoading: false,
        isSyncing: false,
        isAuthenticated: localStorage.getItem('contactApp_authenticated') === 'true',
        currentSort: localStorage.getItem('contactApp_sort') || 'name',
        searchQuery: '',
        lastSync: localStorage.getItem('contactApp_lastSync') || null,
        syncStats: {
            success: 0,
            failed: 0
        },
        lastScrollPosition: 0
    };

    // عناصر DOM
    const DOM = {
        authScreen: null,
        appContainer: null,
        contactsContainer: null,
        searchInput: null,
        notificationCenter: null,
        loadingOverlay: null,
        loadingText: null,
        passwordInput: null,
        passwordToggle: null,
        authSubmit: null,
        authMessage: null,
        totalContacts: null,
        totalPhones: null,
        totalWhatsapp: null,
        totalTelegram: null,
        contactsCount: null,
        lastSyncElement: null,
        syncBadge: null,
        manualSync: null,
        logoutBtn: null,
        searchClear: null,
        sortBtn: null,
        sortModal: null,
        mainHeader: null
    };

    // ========== دوال المساعدة ==========
    const helpers = {
        debounce(func, wait) {
            let timeout;
            return function executedFunction(...args) {
                const later = () => {
                    clearTimeout(timeout);
                    func(...args);
                };
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
            };
        },

        throttle(func, limit) {
            let inThrottle;
            return function(...args) {
                if (!inThrottle) {
                    func.apply(this, args);
                    inThrottle = true;
                    setTimeout(() => inThrottle = false, limit);
                }
            };
        },

        escapeHtml(text) {
            if (text === null || text === undefined) return '';
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        },

        formatPhoneNumber(phone) {
            if (!phone) return '';
            // إزالة جميع المحارف غير الرقمية
            let cleaned = phone.toString().replace(/\D/g, '');
            
            // معالجة الأرقام السورية
            if (cleaned.startsWith('00')) {
                cleaned = '+' + cleaned.substring(2);
            } else if (cleaned.startsWith('0')) {
                cleaned = '+963' + cleaned.substring(1);
            } else if (cleaned.startsWith('9') && cleaned.length === 9) {
                cleaned = '+963' + cleaned;
            }
            
            return cleaned;
        },

        formatDate(date) {
            if (!date) return '--';
            const d = new Date(date);
            const now = new Date();
            const diff = now - d;
            
            // إذا كان أقل من يوم
            if (diff < 24 * 60 * 60 * 1000) {
                const hours = Math.floor(diff / (60 * 60 * 1000));
                if (hours < 1) {
                    const minutes = Math.floor(diff / (60 * 1000));
                    return `قبل ${minutes} دقيقة`;
                }
                return `قبل ${hours} ساعة`;
            }
            
            return d.toLocaleDateString('ar-SA', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        },

        generateId() {
            return Date.now().toString(36) + Math.random().toString(36).substr(2);
        },

        copyToClipboard(text) {
            return new Promise((resolve, reject) => {
                if (navigator.clipboard) {
                    navigator.clipboard.writeText(text).then(resolve).catch(reject);
                } else {
                    // Fallback for older browsers
                    const textArea = document.createElement('textarea');
                    textArea.value = text;
                    document.body.appendChild(textArea);
                    textArea.select();
                    try {
                        document.execCommand('copy');
                        resolve();
                    } catch (err) {
                        reject(err);
                    }
                    document.body.removeChild(textArea);
                }
            });
        },

        getAvatarColor(name) {
            if (!name) return '#6366f1';
            const colors = [
                '#6366f1', '#10b981', '#f59e0b', '#ef4444', '#06b6d4',
                '#8b5cf6', '#ec4899', '#f97316', '#14b8a6', '#64748b'
            ];
            const index = name.charCodeAt(0) % colors.length;
            return colors[index];
        },

        // دالة جديدة لمعالجة أسماء الأعمدة المختلفة
        normalizeColumnName(colName) {
            if (!colName) return '';
            return colName.toString()
                .toLowerCase()
                .replace(/\s+/g, '')
                .replace(/[ًٌٍَُِّْ]/g, '') // إزالة التشكيل
                .trim();
        }
    };

    // ========== إدارة المصادقة ==========
    const auth = {
        init() {
            DOM.authScreen = document.getElementById('auth-screen');
            DOM.appContainer = document.getElementById('app-container');
            DOM.passwordInput = document.getElementById('password-input');
            DOM.passwordToggle = document.getElementById('toggle-password');
            DOM.authSubmit = document.getElementById('auth-submit');
            DOM.authMessage = document.getElementById('auth-message');

            this.bindEvents();
            this.checkAuthState();
        },

        bindEvents() {
            DOM.authSubmit?.addEventListener('click', (e) => {
                e.preventDefault();
                this.checkPassword();
            });

            DOM.passwordToggle?.addEventListener('click', () => {
                this.togglePasswordVisibility();
            });

            DOM.passwordInput?.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.checkPassword();
                }
            });

            DOM.logoutBtn?.addEventListener('click', () => {
                this.logout();
            });
        },

        checkAuthState() {
            if (state.isAuthenticated) {
                this.hideAuthScreen();
                app.init();
            } else {
                this.showAuthScreen();
            }
        },

        checkPassword() {
            const password = DOM.passwordInput?.value.trim();
            
            if (!password) {
                this.showMessage('يرجى إدخال كلمة المرور', 'error');
                return;
            }

            if (password === DEFAULT_PASSWORD) {
                state.isAuthenticated = true;
                localStorage.setItem('contactApp_authenticated', 'true');
                this.hideAuthScreen();
                app.init();
                this.showMessage('تمت المصادقة بنجاح', 'success');
            } else {
                this.showMessage('كلمة المرور غير صحيحة', 'error');
                DOM.passwordInput.value = '';
                DOM.passwordInput.classList.add('shake');
                setTimeout(() => {
                    DOM.passwordInput.classList.remove('shake');
                }, 500);
            }
        },

        togglePasswordVisibility() {
            if (DOM.passwordInput.type === 'password') {
                DOM.passwordInput.type = 'text';
                DOM.passwordToggle.innerHTML = '<i class="fas fa-eye-slash"></i>';
            } else {
                DOM.passwordInput.type = 'password';
                DOM.passwordToggle.innerHTML = '<i class="fas fa-eye"></i>';
            }
        },

        showMessage(message, type) {
            if (!DOM.authMessage) return;
            
            DOM.authMessage.textContent = message;
            DOM.authMessage.className = `auth-message ${type}`;
            DOM.authMessage.style.display = 'block';
            
            setTimeout(() => {
                DOM.authMessage.style.display = 'none';
            }, 3000);
        },

        showAuthScreen() {
            if (DOM.authScreen) DOM.authScreen.style.display = 'flex';
            if (DOM.appContainer) DOM.appContainer.style.display = 'none';
            DOM.passwordInput?.focus();
        },

        hideAuthScreen() {
            if (DOM.authScreen) DOM.authScreen.style.display = 'none';
            if (DOM.appContainer) DOM.appContainer.style.display = 'block';
        },

        logout() {
            if (confirm('هل تريد تسجيل الخروج؟')) {
                state.isAuthenticated = false;
                localStorage.removeItem('contactApp_authenticated');
                this.showAuthScreen();
                DOM.passwordInput.value = '';
                ui.showNotification('تم تسجيل الخروج', 'info');
            }
        }
    };

    // ========== واجهة المستخدم ==========
    const ui = {
        init() {
            this.cacheElements();
            this.bindEvents();
            this.setupView();
        },

        cacheElements() {
            // العناصر الأساسية
            DOM.contactsContainer = document.getElementById('contacts-container');
            DOM.searchInput = document.getElementById('search-input');
            DOM.notificationCenter = document.getElementById('notification-center');
            DOM.loadingOverlay = document.getElementById('loading-overlay');
            DOM.loadingText = document.getElementById('loading-text');
            
            // الإحصائيات
            DOM.totalContacts = document.getElementById('total-contacts');
            DOM.totalPhones = document.getElementById('total-phones');
            DOM.totalWhatsapp = document.getElementById('total-whatsapp');
            DOM.totalTelegram = document.getElementById('total-telegram');
            
            // معلومات التطبيق
            DOM.contactsCount = document.getElementById('contacts-count');
            DOM.lastSyncElement = document.getElementById('last-sync');
            DOM.syncBadge = document.getElementById('sync-badge');
            
            // الأزرار
            DOM.manualSync = document.getElementById('manual-sync');
            DOM.logoutBtn = document.getElementById('logout-btn');
            DOM.searchClear = document.getElementById('search-clear');
            DOM.sortBtn = document.getElementById('sort-btn');
            DOM.sortModal = document.getElementById('sort-modal');
            DOM.mainHeader = document.getElementById('main-header');
        },

        bindEvents() {
            // البحث
            if (DOM.searchInput) {
                DOM.searchInput.addEventListener('input', helpers.debounce(() => {
                    this.handleSearch();
                }, 300));
            }

            // مسح البحث
            if (DOM.searchClear) {
                DOM.searchClear.addEventListener('click', () => {
                    DOM.searchInput.value = '';
                    this.handleSearch();
                    DOM.searchClear.style.display = 'none';
                });
            }

            // تحديث عرض البحث
            if (DOM.searchInput) {
                DOM.searchInput.addEventListener('input', () => {
                    DOM.searchClear.style.display = DOM.searchInput.value ? 'block' : 'none';
                });
            }

            // المزامنة اليدوية
            if (DOM.manualSync) {
                DOM.manualSync.addEventListener('click', () => {
                    data.sync(true);
                });
            }

            // التصنيف
            if (DOM.sortBtn && DOM.sortModal) {
                DOM.sortBtn.addEventListener('click', () => {
                    this.showSortModal();
                });

                // إغلاق قائمة التصنيف
                DOM.sortModal.addEventListener('click', (e) => {
                    if (e.target === DOM.sortModal || e.target.classList.contains('close-sort')) {
                        this.hideSortModal();
                    }
                });

                // اختيار تصنيف
                DOM.sortModal.querySelectorAll('button[data-sort]').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        const sortBy = e.target.dataset.sort;
                        this.handleSort(sortBy);
                        this.hideSortModal();
                    });
                });
            }

            // إدارة إخفاء الهيدر عند التمرير
            window.addEventListener('scroll', helpers.throttle(() => {
                this.handleScroll();
            }, 100));

            // اكتشاف حالة الاتصال
            window.addEventListener('online', () => {
                this.showNotification('تم استعادة الاتصال', 'success');
                data.sync();
            });

            window.addEventListener('offline', () => {
                this.showNotification('فقدت الاتصال بالإنترنت', 'warning');
            });
        },

        setupView() {
            // تطبيق التصنيف المحفوظ
            this.handleSort(state.currentSort, false);
            
            // تحديث وقت آخر مزامنة
            this.updateLastSync();
            
            // إضافة أنماط للهز
            this.addShakeAnimation();
        },

        handleScroll() {
            if (!DOM.mainHeader) return;
            
            const currentScroll = window.pageYOffset;
            const isScrolledDown = currentScroll > state.lastScrollPosition;
            
            if (currentScroll > 100) {
                DOM.mainHeader.classList.add('scrolled');
                if (isScrolledDown && currentScroll > 200) {
                    DOM.mainHeader.classList.add('hidden');
                } else {
                    DOM.mainHeader.classList.remove('hidden');
                }
            } else {
                DOM.mainHeader.classList.remove('scrolled', 'hidden');
            }
            
            state.lastScrollPosition = currentScroll;
        },

        handleSearch() {
            const query = DOM.searchInput?.value.trim().toLowerCase() || '';
            state.searchQuery = query;
            
            if (!query) {
                state.filteredContacts = [...state.contacts];
            } else {
                state.filteredContacts = state.contacts.filter(contact => {
                    const searchFields = [
                        contact.name,
                        contact.lastName,
                        contact.phone,
                        contact.whatsapp,
                        contact.telegram,
                        contact.address,
                        contact.category
                    ];
                    
                    return searchFields.some(field => 
                        field && field.toString().toLowerCase().includes(query)
                    );
                });
            }
            
            this.renderContacts();
            this.updateStats();
        },

        handleSort(sortBy, save = true) {
            state.currentSort = sortBy;
            if (save) {
                localStorage.setItem('contactApp_sort', sortBy);
            }
            
            switch (sortBy) {
                case 'name':
                    state.filteredContacts.sort((a, b) => 
                        (a.name || '').localeCompare(b.name || '', 'ar')
                    );
                    break;
                case 'name-desc':
                    state.filteredContacts.sort((a, b) => 
                        (b.name || '').localeCompare(a.name || '', 'ar')
                    );
                    break;
                case 'date':
                    state.filteredContacts.sort((a, b) => 
                        new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
                    );
                    break;
                case 'category':
                    state.filteredContacts.sort((a, b) => 
                        (a.category || '').localeCompare(b.category || '', 'ar')
                    );
                    break;
            }
            
            this.renderContacts();
        },

        showSortModal() {
            if (DOM.sortModal) {
                DOM.sortModal.style.display = 'flex';
            }
        },

        hideSortModal() {
            if (DOM.sortModal) {
                DOM.sortModal.style.display = 'none';
            }
        },

        renderContacts() {
            if (!DOM.contactsContainer) return;
            
            if (state.filteredContacts.length === 0) {
                this.renderEmptyState();
                return;
            }
            
            const contactsHTML = state.filteredContacts.map(contact => 
                this.generateContactCard(contact)
            ).join('');
            
            DOM.contactsContainer.innerHTML = contactsHTML;
            this.attachContactEvents();
        },

        generateContactCard(contact) {
            const firstLetter = (contact.name?.charAt(0) || '?').toUpperCase();
            const fullName = `${contact.name || ''} ${contact.lastName || ''}`.trim();
            const category = contact.category || 'أخرى';
            const avatarColor = helpers.getAvatarColor(contact.name);
            
            return `
                <div class="contact-card" data-id="${contact.id}">
                    <div class="contact-header">
                        <div class="contact-avatar" style="background: ${avatarColor}">
                            ${firstLetter}
                        </div>
                        <div class="contact-info">
                            <h3 class="contact-name">${helpers.escapeHtml(fullName)}</h3>
                            <span class="contact-category">${helpers.escapeHtml(category)}</span>
                        </div>
                    </div>
                    
                    <div class="contact-details">
                        ${contact.phone ? `
                            <div class="contact-detail">
                                <i class="fas fa-phone"></i>
                                <span>${contact.phone}</span>
                            </div>
                        ` : ''}
                        
                        ${contact.whatsapp ? `
                            <div class="contact-detail">
                                <i class="fab fa-whatsapp"></i>
                                <span>${contact.whatsapp}</span>
                            </div>
                        ` : ''}
                        
                        ${contact.telegram ? `
                            <div class="contact-detail">
                                <i class="fab fa-telegram"></i>
                                <span>${contact.telegram}</span>
                            </div>
                        ` : ''}
                        
                        ${contact.address ? `
                            <div class="contact-detail address">
                                <i class="fas fa-map-marker-alt"></i>
                                <span>${helpers.escapeHtml(contact.address)}</span>
                            </div>
                        ` : ''}
                    </div>
                    
                    <div class="contact-actions">
                        ${contact.phone ? `
                            <button class="contact-action-btn call" data-phone="${contact.phone}">
                                <i class="fas fa-phone"></i>
                                <span>اتصال</span>
                            </button>
                        ` : ''}
                        
                        ${contact.whatsapp ? `
                            <button class="contact-action-btn whatsapp" data-whatsapp="${contact.whatsapp}">
                                <i class="fab fa-whatsapp"></i>
                                <span>واتساب</span>
                            </button>
                        ` : ''}
                        
                        ${contact.telegram ? `
                            <button class="contact-action-btn telegram" data-telegram="${contact.telegram}">
                                <i class="fab fa-telegram"></i>
                                <span>تليجرام</span>
                            </button>
                        ` : ''}
                    </div>
                </div>
            `;
        },

        renderEmptyState() {
            if (!DOM.contactsContainer) return;
            
            const message = state.searchQuery 
                ? 'لا توجد نتائج للبحث'
                : 'لا توجد جهات اتصال بعد';
            
            const icon = state.searchQuery ? 'fa-search' : 'fa-users';
            
            DOM.contactsContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">
                        <i class="fas ${icon}"></i>
                    </div>
                    <h3>${message}</h3>
                    ${!state.searchQuery ? `
                        <p>جاري تحميل البيانات...</p>
                        <div class="loading-spinner"></div>
                    ` : ''}
                </div>
            `;
        },

        attachContactEvents() {
            // الاتصال
            document.querySelectorAll('.contact-action-btn.call').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const phone = e.currentTarget.dataset.phone;
                    if (phone) {
                        const cleanPhone = phone.replace(/\D/g, '');
                        window.location.href = `tel:${cleanPhone}`;
                    }
                });
            });

            // واتساب
            document.querySelectorAll('.contact-action-btn.whatsapp').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const whatsapp = e.currentTarget.dataset.whatsapp;
                    if (whatsapp) {
                        const cleanNumber = whatsapp.replace(/\D/g, '');
                        window.open(`https://wa.me/${cleanNumber}`, '_blank');
                    }
                });
            });

            // تليجرام
            document.querySelectorAll('.contact-action-btn.telegram').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const telegram = e.currentTarget.dataset.telegram;
                    if (telegram) {
                        const cleanUsername = telegram.replace('@', '');
                        window.open(`https://t.me/${cleanUsername}`, '_blank');
                    }
                });
            });
        },

        updateStats() {
            const totalContacts = state.contacts.length;
            const phones = state.contacts.filter(c => c.phone).length;
            const whatsapp = state.contacts.filter(c => c.whatsapp).length;
            const telegram = state.contacts.filter(c => c.telegram).length;
            
            if (DOM.totalContacts) DOM.totalContacts.textContent = totalContacts;
            if (DOM.totalPhones) DOM.totalPhones.textContent = phones;
            if (DOM.totalWhatsapp) DOM.totalWhatsapp.textContent = whatsapp;
            if (DOM.totalTelegram) DOM.totalTelegram.textContent = telegram;
            
            // تحديث العداد
            const filteredCount = state.filteredContacts.length;
            if (DOM.contactsCount) {
                DOM.contactsCount.textContent = totalContacts === filteredCount ? 
                    `${totalContacts} جهة اتصال` : 
                    `${filteredCount} من ${totalContacts}`;
            }
        },

        updateLastSync() {
            if (DOM.lastSyncElement && state.lastSync) {
                DOM.lastSyncElement.textContent = `آخر تحديث: ${helpers.formatDate(state.lastSync)}`;
            }
        },

        showNotification(message, type = 'info', duration = 4000) {
            if (!DOM.notificationCenter) return;
            
            const notification = document.createElement('div');
            notification.className = `notification notification-${type}`;
            
            const icons = {
                success: 'check-circle',
                error: 'exclamation-circle',
                warning: 'exclamation-triangle',
                info: 'info-circle'
            };
            
            notification.innerHTML = `
                <i class="fas fa-${icons[type] || 'info-circle'}"></i>
                <div class="notification-content">
                    <div class="notification-message">${message}</div>
                </div>
                <button class="notification-close">
                    <i class="fas fa-times"></i>
                </button>
            `;
            
            DOM.notificationCenter.appendChild(notification);
            
            // إضافة حدث الإغلاق
            notification.querySelector('.notification-close').addEventListener('click', () => {
                notification.remove();
            });
            
            // إزالة تلقائية
            if (duration > 0) {
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.remove();
                    }
                }, duration);
            }
        },

        showLoading(message = 'جاري التحميل...') {
            if (DOM.loadingOverlay && DOM.loadingText) {
                DOM.loadingText.textContent = message;
                DOM.loadingOverlay.style.display = 'flex';
            }
        },

        hideLoading() {
            if (DOM.loadingOverlay) {
                DOM.loadingOverlay.style.display = 'none';
            }
        },

        addShakeAnimation() {
            const style = document.createElement('style');
            style.textContent = `
                @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
                    20%, 40%, 60%, 80% { transform: translateX(5px); }
                }
                .shake { animation: shake 0.5s ease-in-out; }
            `;
            document.head.appendChild(style);
        }
    };

    // ========== إدارة البيانات ==========
    const data = {
        async init() {
            await this.loadFromLocalStorage();
            
            if (state.contacts.length === 0) {
                this.loadSampleData();
            }
            
            ui.updateStats();
            ui.renderContacts();
            
            // المزامنة التلقائية إذا كان هناك اتصال
            if (navigator.onLine) {
                setTimeout(() => this.sync(), 2000);
            }
        },

        async sync(force = false) {
            if (state.isSyncing && !force) {
                ui.showNotification('جاري المزامنة بالفعل', 'info');
                return;
            }
            
            if (!navigator.onLine) {
                ui.showNotification('غير متصل بالإنترنت', 'warning');
                return;
            }
            
            state.isSyncing = true;
            ui.showLoading('جاري المزامنة...');
            
            try {
                let success = false;
                let lastError = null;
                
                // تجربة جميع مصادر البيانات
                for (let i = 0; i < CONFIG.dataSources.length; i++) {
                    const source = CONFIG.dataSources[i];
                    
                    try {
                        success = await this.fetchFromSource(source);
                        if (success) break;
                    } catch (error) {
                        lastError = error;
                        console.warn(`فشل المصدر ${source.name}:`, error);
                    }
                }
                
                if (success) {
                    state.lastSync = new Date().toISOString();
                    localStorage.setItem('contactApp_lastSync', state.lastSync);
                    ui.updateLastSync();
                    
                    state.syncStats.success++;
                    
                    ui.showNotification(`تمت المزامنة - ${state.contacts.length} جهة اتصال`, 'success');
                    
                    // تحديث العداد
                    if (DOM.syncBadge) {
                        DOM.syncBadge.textContent = '';
                    }
                } else {
                    throw lastError || new Error('فشلت جميع مصادر البيانات');
                }
                
            } catch (error) {
                console.error('خطأ المزامنة:', error);
                
                state.syncStats.failed++;
                
                let errorMessage = 'فشلت المزامنة - استخدام البيانات المحلية';
                if (error.message.includes('CORS') || error.message.includes('Failed to fetch')) {
                    errorMessage = 'مشكلة في الاتصال بالخادم';
                } else if (error.message.includes('404')) {
                    errorMessage = 'ملف البيانات غير موجود';
                }
                
                ui.showNotification(errorMessage, 'error');
                
                // تحديث العداد
                if (DOM.syncBadge) {
                    DOM.syncBadge.textContent = '!';
                }
            } finally {
                state.isSyncing = false;
                ui.hideLoading();
            }
        },

        async fetchFromSource(source) {
            let url = source.url;
            
            // استخدام CORS proxy إذا لزم الأمر
            if (source.proxy) {
                url = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
            }
            
            const response = await fetch(url, {
                headers: {
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const arrayBuffer = await response.arrayBuffer();
            
            if (arrayBuffer.byteLength === 0) {
                throw new Error('ملف فارغ');
            }
            
            // معالجة ملف Excel
            const workbook = XLSX.read(arrayBuffer, { type: 'array' });
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
            
            if (!jsonData || jsonData.length === 0) {
                throw new Error('لا توجد بيانات في الملف');
            }
            
            // معالجة البيانات
            const newContacts = this.processExcelData(jsonData);
            
            if (newContacts.length === 0) {
                throw new Error('لا توجد جهات اتصال صالحة');
            }
            
            // دمج البيانات الجديدة مع القديمة
            this.mergeContacts(newContacts);
            
            return true;
        },

        processExcelData(jsonData) {
            const contacts = [];
            
            // تعريف أسماء الأعمدة المتوقعة في Excel
            const columnMappings = {
                name: ['الاسم', 'name', 'اسم', 'اسم الجهة', 'الاسم الكامل'],
                lastName: ['اللقب', 'lastname', 'last name', 'لقب', 'الكنية', 'العائلة'],
                phone: ['رقم الهاتف', 'phone', 'هاتف', 'جوال', 'تلفون', 'رقم الجوال', 'رقم التلفون'],
                whatsapp: ['رقم الواتساب', 'whatsapp', 'واتساب', 'رقم واتساب', 'whats app'],
                telegram: ['حساب التليجرام', 'telegram', 'تيليجرام', 'تلجرام', 'telegram', 'حساب تيليجرام'],
                address: ['العنوان', 'address', 'عنوان', 'المكان', 'الموقع', 'السكن']
            };
            
            const findColumnValue = (row, keys) => {
                for (const key of keys) {
                    const normalizedKey = helpers.normalizeColumnName(key);
                    
                    // البحث عن العمود الذي يتطابق مع المفتاح
                    for (const columnName in row) {
                        const normalizedColumn = helpers.normalizeColumnName(columnName);
                        
                        if (normalizedColumn.includes(normalizedKey) || 
                            normalizedKey.includes(normalizedColumn)) {
                            const value = row[columnName];
                            if (value !== undefined && value !== null && value !== '') {
                                return value.toString().trim();
                            }
                        }
                    }
                }
                return '';
            };
            
            console.log('معالجة بيانات Excel:', jsonData.length, 'صف');
            
            for (const row of jsonData) {
                try {
                    // البحث عن القيم باستخدام التعريفات
                    const name = findColumnValue(row, columnMappings.name);
                    const lastName = findColumnValue(row, columnMappings.lastName);
                    const phone = findColumnValue(row, columnMappings.phone);
                    const whatsapp = findColumnValue(row, columnMappings.whatsapp);
                    const telegram = findColumnValue(row, columnMappings.telegram);
                    const address = findColumnValue(row, columnMappings.address);
                    
                    // تجاهل الصفوف بدون بيانات أساسية
                    if (!name && !phone && !whatsapp && !telegram) {
                        continue;
                    }
                    
                    const contact = {
                        id: helpers.generateId(),
                        name: name || 'بدون اسم',
                        lastName: lastName,
                        phone: this.cleanPhoneNumber(phone),
                        whatsapp: this.cleanPhoneNumber(whatsapp),
                        telegram: this.cleanTelegramUsername(telegram),
                        address: address,
                        category: this.detectCategory(name, lastName, address),
                        createdAt: new Date().toISOString()
                    };
                    
                    contacts.push(contact);
                } catch (error) {
                    console.warn('خطأ في معالجة الصف:', error, row);
                }
            }
            
            console.log('تم معالجة', contacts.length, 'جهة اتصال');
            return contacts;
        },

        cleanPhoneNumber(phone) {
            if (!phone) return '';
            
            // إزالة المسافات والرموز
            let cleaned = phone.toString()
                .replace(/\s+/g, '')
                .replace(/[()\-+]/g, '')
                .replace(/[^\d]/g, '')
                .trim();
            
            // معالجة الأرقام السورية
            if (cleaned.startsWith('00963')) {
                cleaned = '+963' + cleaned.substring(5);
            } else if (cleaned.startsWith('963')) {
                cleaned = '+' + cleaned;
            } else if (cleaned.startsWith('0')) {
                cleaned = '+963' + cleaned.substring(1);
            } else if (cleaned.length === 9 && cleaned.startsWith('9')) {
                cleaned = '+963' + cleaned;
            }
            
            // التحقق من صحة الرقم (على الأقل 10 أرقام)
            if (cleaned.replace(/\D/g, '').length < 10) {
                return '';
            }
            
            return cleaned;
        },

        cleanTelegramUsername(username) {
            if (!username) return '';
            
            let cleaned = username.toString()
                .replace(/^@+/, '')
                .replace(/\s+/g, '')
                .trim();
            
            // إزالة أي مسافات أو رموز غير مرغوبة
            cleaned = cleaned.replace(/[^a-zA-Z0-9_]/g, '');
            
            return cleaned;
        },

        detectCategory(name, lastName, address) {
            // كلمات دلالية للتصنيف التلقائي
            const familyKeywords = ['أبو', 'أم', 'ابن', 'بنت', 'عائلة', 'قريب', 'عم', 'خال', 'عمة', 'خالة'];
            const workKeywords = ['شركة', 'مؤسسة', 'مكتب', 'عمل', 'مدير', 'مهندس', 'دكتور', 'مدرسة', 'مستشفى'];
            const friendKeywords = ['صديق', 'زميل', 'رفيق'];
            
            const fullText = `${name} ${lastName} ${address}`.toLowerCase();
            
            for (const keyword of familyKeywords) {
                if (fullText.includes(keyword)) return 'عائلة';
            }
            
            for (const keyword of workKeywords) {
                if (fullText.includes(keyword)) return 'عمل';
            }
            
            for (const keyword of friendKeywords) {
                if (fullText.includes(keyword)) return 'أصدقاء';
            }
            
            return 'أخرى';
        },

        mergeContacts(newContacts) {
            const mergedContacts = [...state.contacts];
            
            for (const newContact of newContacts) {
                // البحث عن جهة اتصال موجودة بنفس الرقم
                const existingIndex = mergedContacts.findIndex(c => 
                    (c.phone && c.phone === newContact.phone) ||
                    (c.whatsapp && c.whatsapp === newContact.whatsapp) ||
                    (c.name === newContact.name && c.lastName === newContact.lastName)
                );
                
                if (existingIndex !== -1) {
                    // تحديث جهة الاتصال الموجودة مع الحفاظ على البيانات القديمة
                    mergedContacts[existingIndex] = {
                        ...mergedContacts[existingIndex],
                        ...newContact,
                        id: mergedContacts[existingIndex].id // الحفاظ على نفس الـ ID
                    };
                } else {
                    // إضافة جهة اتصال جديدة
                    mergedContacts.push(newContact);
                }
            }
            
            state.contacts = mergedContacts;
            state.filteredContacts = [...mergedContacts];
            
            this.saveToLocalStorage();
            ui.renderContacts();
            ui.updateStats();
        },

        loadFromLocalStorage() {
            try {
                const saved = localStorage.getItem('contactApp_data');
                if (saved) {
                    const data = JSON.parse(saved);
                    state.contacts = data.contacts || [];
                    state.filteredContacts = [...state.contacts];
                    state.lastSync = data.lastSync || null;
                    
                    console.log(`تم تحميل ${state.contacts.length} جهة اتصال`);
                }
            } catch (error) {
                console.error('خطأ في تحميل البيانات:', error);
                state.contacts = [];
                state.filteredContacts = [];
            }
        },

        saveToLocalStorage() {
            try {
                const data = {
                    contacts: state.contacts,
                    lastSync: state.lastSync,
                    version: CONFIG.version,
                    timestamp: new Date().toISOString()
                };
                
                localStorage.setItem('contactApp_data', JSON.stringify(data));
            } catch (error) {
                console.error('خطأ في حفظ البيانات:', error);
            }
        },

        loadSampleData() {
            const sampleContacts = [
                {
                    id: '1',
                    name: 'أحمد',
                    lastName: 'محمد',
                    phone: '+963991234567',
                    whatsapp: '+963991234567',
                    telegram: 'ahmedm',
                    address: 'دمشق - المزة',
                    category: 'أصدقاء',
                    createdAt: '2026-01-15T10:30:00Z'
                },
                {
                    id: '2',
                    name: 'سارة',
                    lastName: 'الخطيب',
                    phone: '+963992345678',
                    whatsapp: '+963992345678',
                    telegram: 'sara_k',
                    address: 'حلب - السليمانية',
                    category: 'عائلة',
                    createdAt: '2026-01-14T09:15:00Z'
                },
                {
                    id: '3',
                    name: 'محمود',
                    lastName: 'الحلبي',
                    phone: '+963993456789',
                    whatsapp: '+963993456789',
                    address: 'اللاذقية - وسط المدينة',
                    category: 'عمل',
                    createdAt: '2026-01-13T14:45:00Z'
                }
            ];
            
            state.contacts = sampleContacts;
            state.filteredContacts = [...sampleContacts];
            
            this.saveToLocalStorage();
            ui.showNotification('تم تحميل البيانات', 'info');
        }
    };

    // ========== التطبيق الرئيسي ==========
    const app = {
        init() {
            console.log(`دليل الاتصال الذكي ${CONFIG.version} - 2026`);
            
            ui.init();
            data.init();
            
            this.startAutoSync();
        },

        startAutoSync() {
            // المزامنة التلقائية كل 5 دقائق
            setInterval(() => {
                if (navigator.onLine && !state.isSyncing) {
                    data.sync();
                }
            }, CONFIG.syncInterval);
            
            // تحديث عداد المزامنة
            if (DOM.syncBadge) {
                setInterval(() => {
                    if (state.syncStats.failed > 0) {
                        DOM.syncBadge.textContent = state.syncStats.failed;
                    }
                }, 60000);
            }
        },

        // دوال عامة للوصول من خارج الوحدة
        getState() {
            return { ...state };
        },

        getContacts() {
            return [...state.contacts];
        },

        sync(force = false) {
            data.sync(force);
        }
    };

    // ========== التصدير ==========
    return {
        init: () => auth.init(),
        app
    };
})();

// ========== التهيئة عند تحميل الصفحة ==========
document.addEventListener('DOMContentLoaded', () => {
    SmartContactApp.init();
    
    // لجعل التطبيق متاحاً عالمياً
    window.SmartContactApp = SmartContactApp;
});
