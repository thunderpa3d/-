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
        maxRetries: 3,
        retryDelay: 2000,
        cacheTimeout: 10 * 60 * 1000, // 10 دقائق
        version: '2.1.0'
    };

    // حالة التطبيق
    let state = {
        contacts: [],
        filteredContacts: [],
        categories: new Set(),
        isLoading: false,
        isSyncing: false,
        isAuthenticated: localStorage.getItem('contactApp_authenticated') === 'true',
        currentView: localStorage.getItem('contactApp_view') || 'grid',
        currentSort: localStorage.getItem('contactApp_sort') || 'name',
        searchQuery: '',
        lastSync: localStorage.getItem('contactApp_lastSync') || null,
        syncStats: {
            success: 0,
            failed: 0,
            lastAttempt: null
        }
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
        progressBar: null,
        contactModal: null,
        settingsModal: null,
        contactForm: null,
        passwordInput: null,
        passwordToggle: null,
        authSubmit: null,
        authMessage: null,
        totalContacts: null,
        totalPhones: null,
        totalWhatsapp: null,
        totalTelegram: null,
        contactsCount: null,
        cacheSize: null,
        lastSyncElement: null,
        syncBadge: null,
        manualSync: null,
        addContactBtn: null,
        fabAdd: null,
        exportBtn: null,
        logoutBtn: null,
        searchClear: null,
        sortBtn: null,
        sortOptions: null,
        viewButtons: null
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
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        },

        formatPhoneNumber(phone) {
            if (!phone) return '';
            const cleaned = phone.replace(/\D/g, '');
            const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/);
            if (match) {
                return `${match[1]} ${match[2]} ${match[3]}`;
            }
            return phone;
        },

        formatDate(date) {
            if (!date) return '--';
            const d = new Date(date);
            return d.toLocaleDateString('ar-SA', {
                hour: '2-digit',
                minute: '2-digit'
            });
        },

        generateId() {
            return Date.now().toString(36) + Math.random().toString(36).substr(2);
        },

        calculateCacheSize() {
            let total = 0;
            for (let key in localStorage) {
                if (localStorage.hasOwnProperty(key)) {
                    total += localStorage[key].length * 2; // UTF-16
                }
            }
            return (total / 1024).toFixed(2);
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
                this.showMessage('تم المصادقة بنجاح!', 'success');
            } else {
                this.showMessage('كلمة المرور غير صحيحة!', 'error');
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
            if (confirm('هل أنت متأكد من تسجيل الخروج؟')) {
                state.isAuthenticated = false;
                localStorage.removeItem('contactApp_authenticated');
                this.showAuthScreen();
                DOM.passwordInput.value = '';
                ui.showNotification('تم تسجيل الخروج بنجاح', 'success');
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
            DOM.progressBar = document.getElementById('progress-bar');
            DOM.contactModal = document.getElementById('contact-modal');
            DOM.settingsModal = document.getElementById('settings-modal');
            DOM.contactForm = document.getElementById('contact-form');
            
            // الإحصائيات
            DOM.totalContacts = document.getElementById('total-contacts');
            DOM.totalPhones = document.getElementById('total-phones');
            DOM.totalWhatsapp = document.getElementById('total-whatsapp');
            DOM.totalTelegram = document.getElementById('total-telegram');
            
            // معلومات التطبيق
            DOM.contactsCount = document.getElementById('contacts-count');
            DOM.cacheSize = document.getElementById('cache-size');
            DOM.lastSyncElement = document.getElementById('last-sync');
            DOM.syncBadge = document.getElementById('sync-badge');
            
            // الأزرار
            DOM.manualSync = document.getElementById('manual-sync');
            DOM.addContactBtn = document.getElementById('add-contact-btn');
            DOM.fabAdd = document.getElementById('fab-add');
            DOM.exportBtn = document.getElementById('export-btn');
            DOM.logoutBtn = document.getElementById('logout-btn');
            DOM.searchClear = document.getElementById('search-clear');
            DOM.sortBtn = document.getElementById('sort-btn');
            DOM.sortOptions = document.getElementById('sort-options');
            DOM.viewButtons = document.querySelectorAll('.view-btn');
            
            // إغلاق المودالات
            document.querySelectorAll('.modal-close').forEach(btn => {
                btn.addEventListener('click', () => {
                    DOM.contactModal.style.display = 'none';
                    DOM.settingsModal.style.display = 'none';
                });
            });
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

            // إضافة جهة اتصال
            if (DOM.addContactBtn) {
                DOM.addContactBtn.addEventListener('click', () => {
                    this.openContactModal();
                });
            }

            if (DOM.fabAdd) {
                DOM.fabAdd.addEventListener('click', () => {
                    this.openContactModal();
                });
            }

            // التصدير
            if (DOM.exportBtn) {
                DOM.exportBtn.addEventListener('click', () => {
                    this.exportContacts();
                });
            }

            // التصنيف
            if (DOM.sortBtn && DOM.sortOptions) {
                DOM.sortBtn.addEventListener('click', () => {
                    DOM.sortOptions.classList.toggle('show');
                });

                // إغلاق قائمة التصنيف عند النقر خارجها
                document.addEventListener('click', (e) => {
                    if (!DOM.sortBtn?.contains(e.target) && !DOM.sortOptions?.contains(e.target)) {
                        DOM.sortOptions?.classList.remove('show');
                    }
                });

                // اختيار تصنيف
                DOM.sortOptions.querySelectorAll('button').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        const sortBy = e.target.dataset.sort;
                        this.handleSort(sortBy);
                        DOM.sortOptions.classList.remove('show');
                    });
                });
            }

            // تغيير طريقة العرض
            DOM.viewButtons?.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const view = e.currentTarget.dataset.view;
                    this.switchView(view);
                });
            });

            // إغلاق المودالات بالنقر خارجها
            window.addEventListener('click', (e) => {
                if (e.target === DOM.contactModal) {
                    DOM.contactModal.style.display = 'none';
                }
                if (e.target === DOM.settingsModal) {
                    DOM.settingsModal.style.display = 'none';
                }
            });

            // اكتشاف حالة الاتصال
            window.addEventListener('online', () => {
                this.showNotification('تم استعادة الاتصال بالإنترنت', 'success');
                data.sync();
            });

            window.addEventListener('offline', () => {
                this.showNotification('فقدت الاتصال بالإنترنت', 'warning');
            });
        },

        setupView() {
            // تطبيق طريقة العرض المحفوظة
            this.switchView(state.currentView, false);
            
            // تطبيق التصنيف المحفوظ
            this.handleSort(state.currentSort, false);
            
            // تحديث حجم الذاكرة المؤقتة
            this.updateCacheSize();
            
            // تحديث وقت آخر مزامنة
            this.updateLastSync();
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
                        contact.email,
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

        switchView(view, save = true) {
            state.currentView = view;
            if (save) {
                localStorage.setItem('contactApp_view', view);
            }
            
            // تحديث الأزرار النشطة
            DOM.viewButtons?.forEach(btn => {
                btn.classList.toggle('active', btn.dataset.view === view);
            });
            
            // تطبيق طريقة العرض
            if (DOM.contactsContainer) {
                DOM.contactsContainer.className = `contacts-${view}`;
                if (view === 'list') {
                    DOM.contactsContainer.classList.add('list-view');
                }
            }
            
            this.renderContacts();
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
            
            return `
                <div class="contact-card" data-id="${contact.id}">
                    <div class="contact-avatar" style="background: ${this.getAvatarColor(contact.name)}">
                        ${firstLetter}
                    </div>
                    
                    <div class="contact-info">
                        <div class="contact-header">
                            <h3 class="contact-name">${helpers.escapeHtml(fullName)}</h3>
                            <span class="contact-category">${helpers.escapeHtml(category)}</span>
                        </div>
                        
                        <div class="contact-details">
                            ${contact.phone ? `
                                <div class="contact-detail">
                                    <i class="fas fa-phone"></i>
                                    <span>${helpers.formatPhoneNumber(contact.phone)}</span>
                                    <button class="copy-btn" data-copy="${contact.phone}" title="نسخ الرقم">
                                        <i class="fas fa-copy"></i>
                                    </button>
                                </div>
                            ` : ''}
                            
                            ${contact.whatsapp ? `
                                <div class="contact-detail">
                                    <i class="fab fa-whatsapp"></i>
                                    <span>${helpers.formatPhoneNumber(contact.whatsapp)}</span>
                                    <div class="contact-actions-small">
                                        <button class="action-btn call" data-phone="${contact.whatsapp}" title="اتصال">
                                            <i class="fas fa-phone"></i>
                                        </button>
                                        <button class="action-btn whatsapp" data-whatsapp="${contact.whatsapp}" title="فتح واتساب">
                                            <i class="fab fa-whatsapp"></i>
                                        </button>
                                    </div>
                                </div>
                            ` : ''}
                            
                            ${contact.telegram ? `
                                <div class="contact-detail">
                                    <i class="fab fa-telegram"></i>
                                    <span>@${helpers.escapeHtml(contact.telegram)}</span>
                                    <button class="action-btn telegram" data-telegram="${contact.telegram}" title="فتح تليجرام">
                                        <i class="fab fa-telegram"></i>
                                    </button>
                                </div>
                            ` : ''}
                            
                            ${contact.email ? `
                                <div class="contact-detail">
                                    <i class="fas fa-envelope"></i>
                                    <span>${helpers.escapeHtml(contact.email)}</span>
                                    <button class="copy-btn" data-copy="${contact.email}" title="نسخ البريد">
                                        <i class="fas fa-copy"></i>
                                    </button>
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
                            
                            <button class="contact-action-btn edit" data-id="${contact.id}">
                                <i class="fas fa-edit"></i>
                                <span>تعديل</span>
                            </button>
                            
                            <button class="contact-action-btn delete" data-id="${contact.id}">
                                <i class="fas fa-trash"></i>
                                <span>حذف</span>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        },

        getAvatarColor(name) {
            if (!name) return '#4a6cf7';
            const colors = [
                '#4a6cf7', '#28a745', '#dc3545', '#ffc107', '#17a2b8',
                '#6f42c1', '#e83e8c', '#fd7e14', '#20c997', '#6c757d'
            ];
            const index = name.charCodeAt(0) % colors.length;
            return colors[index];
        },

        renderEmptyState() {
            if (!DOM.contactsContainer) return;
            
            const message = state.searchQuery 
                ? 'لا توجد نتائج تطابق بحثك'
                : 'لا توجد جهات اتصال بعد. ابدأ بإضافة جهة اتصال جديدة!';
            
            const icon = state.searchQuery ? 'fa-search' : 'fa-user-plus';
            
            DOM.contactsContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">
                        <i class="fas ${icon}"></i>
                    </div>
                    <h3>${message}</h3>
                    ${!state.searchQuery ? `
                        <button id="add-first-contact" class="btn-primary">
                            <i class="fas fa-plus"></i> إضافة جهة اتصال
                        </button>
                    ` : ''}
                </div>
            `;
            
            // إضافة حدث للزر إذا كان موجوداً
            const addBtn = document.getElementById('add-first-contact');
            if (addBtn) {
                addBtn.addEventListener('click', () => this.openContactModal());
            }
        },

        attachContactEvents() {
            // نسخ النص
            document.querySelectorAll('.copy-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const text = e.currentTarget.dataset.copy;
                    if (text) {
                        await helpers.copyToClipboard(text);
                        this.showNotification('تم نسخ النص', 'success');
                    }
                });
            });

            // الاتصال
            document.querySelectorAll('.contact-action-btn.call, .action-btn.call').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const phone = e.currentTarget.dataset.phone;
                    if (phone) {
                        window.location.href = `tel:${phone}`;
                    }
                });
            });

            // واتساب
            document.querySelectorAll('.contact-action-btn.whatsapp, .action-btn.whatsapp').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const whatsapp = e.currentTarget.dataset.whatsapp;
                    if (whatsapp) {
                        const cleanNumber = whatsapp.replace(/\D/g, '');
                        window.open(`https://wa.me/${cleanNumber}`, '_blank');
                    }
                });
            });

            // تليجرام
            document.querySelectorAll('.contact-action-btn.telegram, .action-btn.telegram').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const telegram = e.currentTarget.dataset.telegram;
                    if (telegram) {
                        window.open(`https://t.me/${telegram}`, '_blank');
                    }
                });
            });

            // تعديل
            document.querySelectorAll('.contact-action-btn.edit').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const id = e.currentTarget.dataset.id;
                    this.openContactModal(id);
                });
            });

            // حذف
            document.querySelectorAll('.contact-action-btn.delete').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const id = e.currentTarget.dataset.id;
                    this.deleteContact(id);
                });
            });
        },

        async deleteContact(id) {
            if (!confirm('هل أنت متأكد من حذف جهة الاتصال؟')) return;
            
            const index = state.contacts.findIndex(c => c.id === id);
            if (index !== -1) {
                state.contacts.splice(index, 1);
                state.filteredContacts = state.filteredContacts.filter(c => c.id !== id);
                
                data.saveToLocalStorage();
                this.renderContacts();
                this.updateStats();
                
                this.showNotification('تم حذف جهة الاتصال بنجاح', 'success');
            }
        },

        openContactModal(id = null) {
            const modal = DOM.contactModal;
            const form = DOM.contactForm;
            
            if (!modal || !form) return;
            
            const title = modal.querySelector('.modal-header h2');
            const isEdit = id !== null;
            
            // تعبئة النموذج إذا كان تعديلاً
            if (isEdit) {
                const contact = state.contacts.find(c => c.id === id);
                if (contact) {
                    form.innerHTML = this.generateContactForm(contact);
                    title.innerHTML = '<i class="fas fa-user-edit"></i> تعديل جهة الاتصال';
                } else {
                    return;
                }
            } else {
                form.innerHTML = this.generateContactForm();
                title.innerHTML = '<i class="fas fa-user-plus"></i> إضافة جهة اتصال جديدة';
            }
            
            // إضافة الأحداث للنموذج
            this.attachFormEvents();
            
            // إظهار المودال
            modal.style.display = 'flex';
            setTimeout(() => {
                modal.querySelector('.form-control')?.focus();
            }, 100);
        },

        generateContactForm(contact = {}) {
            return `
                <div class="form-group">
                    <label for="contact-name">الاسم *</label>
                    <input type="text" id="contact-name" class="form-control" 
                           value="${contact.name || ''}" required>
                </div>
                
                <div class="form-group">
                    <label for="contact-lastName">اللقب</label>
                    <input type="text" id="contact-lastName" class="form-control" 
                           value="${contact.lastName || ''}">
                </div>
                
                <div class="form-group">
                    <label for="contact-phone">رقم الهاتف *</label>
                    <input type="tel" id="contact-phone" class="form-control" 
                           value="${contact.phone || ''}" required>
                </div>
                
                <div class="form-group">
                    <label for="contact-whatsapp">رقم الواتساب</label>
                    <input type="tel" id="contact-whatsapp" class="form-control" 
                           value="${contact.whatsapp || ''}">
                </div>
                
                <div class="form-group">
                    <label for="contact-telegram">اسم مستخدم التليجرام</label>
                    <input type="text" id="contact-telegram" class="form-control" 
                           value="${contact.telegram || ''}">
                </div>
                
                <div class="form-group">
                    <label for="contact-email">البريد الإلكتروني</label>
                    <input type="email" id="contact-email" class="form-control" 
                           value="${contact.email || ''}">
                </div>
                
                <div class="form-group">
                    <label for="contact-category">الفئة</label>
                    <select id="contact-category" class="form-control">
                        <option value="عائلة" ${contact.category === 'عائلة' ? 'selected' : ''}>عائلة</option>
                        <option value="أصدقاء" ${contact.category === 'أصدقاء' ? 'selected' : ''}>أصدقاء</option>
                        <option value="عمل" ${contact.category === 'عمل' ? 'selected' : ''}>عمل</option>
                        <option value="أخرى" ${!contact.category || contact.category === 'أخرى' ? 'selected' : ''}>أخرى</option>
                    </select>
                </div>
                
                <div class="form-group">
                    <label for="contact-notes">ملاحظات</label>
                    <textarea id="contact-notes" class="form-control" rows="3">${contact.notes || ''}</textarea>
                </div>
                
                <input type="hidden" id="contact-id" value="${contact.id || helpers.generateId()}">
                
                <div class="form-actions">
                    <button type="button" class="btn-secondary" id="cancel-contact">إلغاء</button>
                    <button type="submit" class="btn-primary" id="save-contact">
                        <i class="fas fa-save"></i> حفظ
                    </button>
                </div>
            `;
        },

        attachFormEvents() {
            const form = DOM.contactForm;
            const modal = DOM.contactModal;
            
            if (!form) return;
            
            // إلغاء
            const cancelBtn = form.querySelector('#cancel-contact');
            if (cancelBtn) {
                cancelBtn.addEventListener('click', () => {
                    modal.style.display = 'none';
                });
            }
            
            // حفظ
            const saveBtn = form.querySelector('#save-contact');
            if (saveBtn) {
                saveBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.saveContact();
                });
            }
            
            // السماح بالحفظ بـ Enter
            form.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && e.target.type !== 'textarea') {
                    e.preventDefault();
                    this.saveContact();
                }
            });
        },

        saveContact() {
            const id = document.getElementById('contact-id')?.value;
            const name = document.getElementById('contact-name')?.value.trim();
            const phone = document.getElementById('contact-phone')?.value.trim();
            
            // التحقق من الحقول المطلوبة
            if (!name || !phone) {
                this.showNotification('الاسم ورقم الهاتف مطلوبان', 'error');
                return;
            }
            
            // إنشاء/تحديث جهة الاتصال
            const contact = {
                id: id || helpers.generateId(),
                name,
                lastName: document.getElementById('contact-lastName')?.value.trim() || '',
                phone,
                whatsapp: document.getElementById('contact-whatsapp')?.value.trim() || '',
                telegram: document.getElementById('contact-telegram')?.value.trim().replace('@', '') || '',
                email: document.getElementById('contact-email')?.value.trim() || '',
                category: document.getElementById('contact-category')?.value || 'أخرى',
                notes: document.getElementById('contact-notes')?.value.trim() || '',
                createdAt: document.getElementById('contact-id')?.value === id ? 
                    (state.contacts.find(c => c.id === id)?.createdAt || new Date().toISOString()) : 
                    new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            
            // تحديث أو إضافة
            const index = state.contacts.findIndex(c => c.id === contact.id);
            if (index !== -1) {
                state.contacts[index] = contact;
                this.showNotification('تم تحديث جهة الاتصال بنجاح', 'success');
            } else {
                state.contacts.push(contact);
                this.showNotification('تم إضافة جهة الاتصال بنجاح', 'success');
            }
            
            // تحديث القائمة
            state.filteredContacts = [...state.contacts];
            this.handleSort(state.currentSort, false);
            
            // حفظ
            data.saveToLocalStorage();
            
            // إغلاق المودال وتحديث الواجهة
            DOM.contactModal.style.display = 'none';
            this.renderContacts();
            this.updateStats();
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
                    `${filteredCount} من ${totalContacts} جهة اتصال`;
            }
        },

        updateCacheSize() {
            if (DOM.cacheSize) {
                const size = helpers.calculateCacheSize();
                DOM.cacheSize.textContent = `الحجم: ${size} KB`;
            }
        },

        updateLastSync() {
            if (DOM.lastSyncElement && state.lastSync) {
                DOM.lastSyncElement.textContent = `آخر تحديث: ${helpers.formatDate(state.lastSync)}`;
            }
        },

        showNotification(message, type = 'info', duration = 5000) {
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
            
            // إزالة بعد 10 ثواني كحد أقصى
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
            }, 10000);
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

        updateProgress(percent) {
            if (DOM.progressBar) {
                DOM.progressBar.style.width = `${percent}%`;
            }
        },

        async exportContacts() {
            if (state.contacts.length === 0) {
                this.showNotification('لا توجد بيانات للتصدير', 'warning');
                return;
            }
            
            try {
                this.showLoading('جاري تحضير البيانات للتصدير...');
                
                const data = state.contacts.map(contact => ({
                    'الاسم': contact.name,
                    'اللقب': contact.lastName,
                    'رقم الهاتف': contact.phone,
                    'واتساب': contact.whatsapp,
                    'تليجرام': contact.telegram,
                    'البريد الإلكتروني': contact.email,
                    'الفئة': contact.category,
                    'الملاحظات': contact.notes,
                    'تاريخ الإنشاء': helpers.formatDate(contact.createdAt),
                    'تاريخ التحديث': helpers.formatDate(contact.updatedAt)
                }));
                
                const worksheet = XLSX.utils.json_to_sheet(data);
                const workbook = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(workbook, worksheet, 'جهات الاتصال');
                
                // إنشاء ملف Excel
                XLSX.writeFile(workbook, `جهات_الاتصال_${new Date().toISOString().split('T')[0]}.xlsx`);
                
                this.showNotification(`تم تصدير ${state.contacts.length} جهة اتصال`, 'success');
            } catch (error) {
                console.error('Export error:', error);
                this.showNotification('فشل تصدير البيانات', 'error');
            } finally {
                this.hideLoading();
            }
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
                ui.showNotification('جاري المزامنة بالفعل...', 'info');
                return;
            }
            
            if (!navigator.onLine) {
                ui.showNotification('غير متصل بالإنترنت', 'warning');
                return;
            }
            
            state.isSyncing = true;
            ui.showLoading('جاري المزامنة مع الخادم...');
            ui.updateProgress(30);
            
            try {
                let success = false;
                let lastError = null;
                
                // تجربة جميع مصادر البيانات
                for (let i = 0; i < CONFIG.dataSources.length; i++) {
                    const source = CONFIG.dataSources[i];
                    ui.updateProgress(30 + (i * 20));
                    ui.showLoading(`جاري المحاولة مع المصدر ${i + 1}...`);
                    
                    try {
                        success = await this.fetchFromSource(source);
                        if (success) break;
                    } catch (error) {
                        lastError = error;
                        console.warn(`Failed with source ${source.name}:`, error);
                    }
                }
                
                if (success) {
                    state.lastSync = new Date().toISOString();
                    localStorage.setItem('contactApp_lastSync', state.lastSync);
                    ui.updateLastSync();
                    
                    state.syncStats.success++;
                    state.syncStats.lastAttempt = new Date().toISOString();
                    
                    ui.updateProgress(100);
                    ui.showNotification(`تمت المزامنة بنجاح - ${state.contacts.length} جهة اتصال`, 'success');
                    
                    // تحديث العداد
                    if (DOM.syncBadge) {
                        DOM.syncBadge.textContent = '';
                    }
                } else {
                    throw lastError || new Error('فشلت جميع مصادر البيانات');
                }
                
            } catch (error) {
                console.error('Sync error:', error);
                
                state.syncStats.failed++;
                state.syncStats.lastAttempt = new Date().toISOString();
                
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
                ui.updateProgress(0);
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
            
            const columnMappings = {
                name: ['الاسم', 'name', 'اسم', 'اسم الجهة'],
                lastName: ['اللقب', 'lastName', 'last name', 'العائلة'],
                phone: ['رقم الهاتف', 'phone', 'هاتف', 'جوال', 'تلفون'],
                whatsapp: ['واتساب', 'whatsapp', 'رقم الواتساب'],
                telegram: ['تليجرام', 'telegram', 'تيليجرام', 'telegram'],
                email: ['البريد الإلكتروني', 'email', 'بريد', 'إيميل'],
                category: ['الفئة', 'category', 'تصنيف', 'نوع'],
                notes: ['ملاحظات', 'notes', 'تفاصيل']
            };
            
            const findColumn = (keys, row) => {
                for (const key of keys) {
                    const foundKey = Object.keys(row).find(k => 
                        helpers.escapeHtml(k).toLowerCase().includes(key.toLowerCase())
                    );
                    if (foundKey && row[foundKey]) {
                        return row[foundKey].toString().trim();
                    }
                }
                return '';
            };
            
            for (const row of jsonData) {
                try {
                    const name = findColumn(columnMappings.name, row);
                    const phone = findColumn(columnMappings.phone, row);
                    
                    // تجاهل الصفوف بدون اسم أو هاتف
                    if (!name && !phone) continue;
                    
                    const contact = {
                        id: helpers.generateId(),
                        name: name || 'بدون اسم',
                        lastName: findColumn(columnMappings.lastName, row),
                        phone: this.cleanPhoneNumber(phone),
                        whatsapp: this.cleanPhoneNumber(findColumn(columnMappings.whatsapp, row)),
                        telegram: this.cleanTelegramUsername(findColumn(columnMappings.telegram, row)),
                        email: findColumn(columnMappings.email, row),
                        category: findColumn(columnMappings.category, row) || 'أخرى',
                        notes: findColumn(columnMappings.notes, row),
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    };
                    
                    contacts.push(contact);
                } catch (error) {
                    console.warn('Error processing row:', error);
                }
            }
            
            return contacts;
        },

        cleanPhoneNumber(phone) {
            if (!phone) return '';
            let cleaned = phone.toString().replace(/\D/g, '');
            
            if (cleaned.startsWith('00')) {
                cleaned = '+' + cleaned.substring(2);
            } else if (cleaned.startsWith('0')) {
                cleaned = '+963' + cleaned.substring(1);
            }
            
            // التحقق من صحة الرقم
            if (cleaned.length < 10) return '';
            
            return cleaned;
        },

        cleanTelegramUsername(username) {
            if (!username) return '';
            return username.toString()
                .replace(/^@+/, '')
                .replace(/[^a-zA-Z0-9_]/, '')
                .trim();
        },

        mergeContacts(newContacts) {
            const mergedContacts = [...state.contacts];
            
            for (const newContact of newContacts) {
                const existingIndex = mergedContacts.findIndex(c => 
                    c.phone === newContact.phone || 
                    (c.name === newContact.name && c.phone)
                );
                
                if (existingIndex !== -1) {
                    // تحديث جهة الاتصال الموجودة
                    mergedContacts[existingIndex] = {
                        ...mergedContacts[existingIndex],
                        ...newContact,
                        id: mergedContacts[existingIndex].id, // الحفاظ على الـ ID
                        createdAt: mergedContacts[existingIndex].createdAt, // الحفاظ على تاريخ الإنشاء
                        updatedAt: new Date().toISOString()
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
                    state.categories = new Set(data.categories || []);
                    state.lastSync = data.lastSync || null;
                    
                    console.log(`Loaded ${state.contacts.length} contacts from localStorage`);
                }
            } catch (error) {
                console.error('Error loading from localStorage:', error);
                state.contacts = [];
                state.filteredContacts = [];
            }
        },

        saveToLocalStorage() {
            try {
                const data = {
                    contacts: state.contacts,
                    categories: Array.from(state.categories),
                    lastSync: state.lastSync,
                    version: CONFIG.version,
                    timestamp: new Date().toISOString()
                };
                
                localStorage.setItem('contactApp_data', JSON.stringify(data));
                ui.updateCacheSize();
            } catch (error) {
                console.error('Error saving to localStorage:', error);
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
                    email: 'ahmed@example.com',
                    category: 'أصدقاء',
                    notes: 'زميل عمل',
                    createdAt: '2024-01-15T10:30:00Z',
                    updatedAt: '2024-01-15T10:30:00Z'
                },
                {
                    id: '2',
                    name: 'سارة',
                    lastName: 'الخطيب',
                    phone: '+963992345678',
                    whatsapp: '+963992345678',
                    telegram: 'sara_k',
                    email: 'sara@example.com',
                    category: 'عائلة',
                    notes: 'قريبة',
                    createdAt: '2024-01-14T09:15:00Z',
                    updatedAt: '2024-01-14T09:15:00Z'
                },
                {
                    id: '3',
                    name: 'محمود',
                    lastName: 'الحلبي',
                    phone: '+963993456789',
                    whatsapp: '+963993456789',
                    category: 'عمل',
                    notes: 'مدير المشروع',
                    createdAt: '2024-01-13T14:45:00Z',
                    updatedAt: '2024-01-13T14:45:00Z'
                }
            ];
            
            state.contacts = sampleContacts;
            state.filteredContacts = [...sampleContacts];
            
            this.saveToLocalStorage();
            ui.showNotification('تم تحميل بيانات تجريبية', 'info');
        }
    };

    // ========== التطبيق الرئيسي ==========
    const app = {
        init() {
            console.log('SmartContactApp v' + CONFIG.version + ' initialized');
            
            ui.init();
            data.init();
            
            this.startAutoSync();
            this.setupServiceWorker();
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

        setupServiceWorker() {
            if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                    navigator.serviceWorker.register('/sw.js').then(
                        (registration) => {
                            console.log('ServiceWorker registered:', registration.scope);
                        },
                        (error) => {
                            console.log('ServiceWorker registration failed:', error);
                        }
                    );
                });
            }
        },

        // دوال عامة للوصول من خارج الوحدة
        getState() {
            return { ...state };
        },

        getContacts() {
            return [...state.contacts];
        },

        getFilteredContacts() {
            return [...state.filteredContacts];
        },

        addContact(contact) {
            if (!contact.id) contact.id = helpers.generateId();
            if (!contact.createdAt) contact.createdAt = new Date().toISOString();
            contact.updatedAt = new Date().toISOString();
            
            state.contacts.push(contact);
            state.filteredContacts.push(contact);
            
            data.saveToLocalStorage();
            ui.renderContacts();
            ui.updateStats();
            
            return contact;
        },

        updateContact(id, updates) {
            const index = state.contacts.findIndex(c => c.id === id);
            if (index !== -1) {
                state.contacts[index] = {
                    ...state.contacts[index],
                    ...updates,
                    updatedAt: new Date().toISOString()
                };
                
                const filteredIndex = state.filteredContacts.findIndex(c => c.id === id);
                if (filteredIndex !== -1) {
                    state.filteredContacts[filteredIndex] = state.contacts[index];
                }
                
                data.saveToLocalStorage();
                ui.renderContacts();
                ui.updateStats();
                
                return state.contacts[index];
            }
            return null;
        },

        deleteContact(id) {
            ui.deleteContact(id);
        },

        search(query) {
            if (DOM.searchInput) {
                DOM.searchInput.value = query;
            }
            state.searchQuery = query;
            ui.handleSearch();
        },

        sync(force = false) {
            data.sync(force);
        }
    };

    // ========== التصدير ==========
    return {
        init: () => auth.init(),
        app,
        helpers,
        auth,
        ui,
        data,
        CONFIG
    };
})();

// ========== التهيئة عند تحميل الصفحة ==========
document.addEventListener('DOMContentLoaded', () => {
    // إضافة أنماط CSS إضافية
    const additionalStyles = document.createElement('style');
    additionalStyles.textContent = `
        @keyframes shake {
            0%, 100% { transform: translateX(0); }
            10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
            20%, 40%, 60%, 80% { transform: translateX(5px); }
        }
        
        .shake {
            animation: shake 0.5s ease-in-out;
        }
        
        .contacts-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
            gap: 1.5rem;
        }
        
        .contacts-grid.list-view {
            grid-template-columns: 1fr;
        }
        
        .contact-card {
            background: white;
            border-radius: 16px;
            padding: 1.5rem;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
            transition: all 0.3s ease;
            display: flex;
            gap: 1rem;
            border: 1px solid rgba(0, 0, 0, 0.05);
        }
        
        .contact-card:hover {
            transform: translateY(-4px);
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
        }
        
        .contact-avatar {
            width: 60px;
            height: 60px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 1.5rem;
            font-weight: bold;
            flex-shrink: 0;
        }
        
        .contact-info {
            flex: 1;
        }
        
        .contact-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 1rem;
        }
        
        .contact-name {
            font-size: 1.25rem;
            font-weight: 600;
            color: #333;
            margin: 0;
        }
        
        .contact-category {
            background: #4a6cf7;
            color: white;
            padding: 0.25rem 0.75rem;
            border-radius: 20px;
            font-size: 0.75rem;
            font-weight: 500;
        }
        
        .contact-details {
            margin-bottom: 1rem;
        }
        
        .contact-detail {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            margin-bottom: 0.5rem;
            padding: 0.5rem;
            background: #f8f9fa;
            border-radius: 8px;
        }
        
        .contact-detail i {
            color: #6c757d;
            width: 20px;
        }
        
        .contact-actions-small {
            display: flex;
            gap: 0.5rem;
            margin-right: auto;
        }
        
        .action-btn {
            width: 32px;
            height: 32px;
            border-radius: 8px;
            border: none;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: all 0.2s ease;
        }
        
        .action-btn.call {
            background: #28a745;
            color: white;
        }
        
        .action-btn.whatsapp {
            background: #25D366;
            color: white;
        }
        
        .action-btn.telegram {
            background: #0088cc;
            color: white;
        }
        
        .action-btn:hover {
            transform: scale(1.1);
        }
        
        .copy-btn {
            background: transparent;
            border: none;
            color: #6c757d;
            cursor: pointer;
            padding: 0.25rem;
            margin-right: auto;
        }
        
        .copy-btn:hover {
            color: #4a6cf7;
        }
        
        .contact-actions {
            display: flex;
            gap: 0.5rem;
            flex-wrap: wrap;
        }
        
        .contact-action-btn {
            flex: 1;
            min-width: 80px;
            padding: 0.5rem;
            border: none;
            border-radius: 8px;
            background: #f8f9fa;
            color: #333;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 0.5rem;
            font-size: 0.875rem;
            transition: all 0.2s ease;
        }
        
        .contact-action-btn:hover {
            background: #e9ecef;
        }
        
        .contact-action-btn.call {
            background: rgba(40, 167, 69, 0.1);
            color: #28a745;
        }
        
        .contact-action-btn.whatsapp {
            background: rgba(37, 211, 102, 0.1);
            color: #25D366;
        }
        
        .contact-action-btn.telegram {
            background: rgba(0, 136, 204, 0.1);
            color: #0088cc;
        }
        
        .contact-action-btn.edit {
            background: rgba(74, 108, 247, 0.1);
            color: #4a6cf7;
        }
        
        .contact-action-btn.delete {
            background: rgba(220, 53, 69, 0.1);
            color: #dc3545;
        }
        
        .empty-state {
            grid-column: 1 / -1;
            text-align: center;
            padding: 4rem 2rem;
        }
        
        .empty-icon {
            width: 80px;
            height: 80px;
            background: #f8f9fa;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 2rem;
            color: #adb5bd;
            margin: 0 auto 1.5rem;
        }
        
        @media (max-width: 768px) {
            .contacts-grid {
                grid-template-columns: 1fr;
            }
            
            .contact-card {
                flex-direction: column;
            }
            
            .contact-avatar {
                align-self: center;
            }
            
            .contact-header {
                flex-direction: column;
                align-items: center;
                text-align: center;
                gap: 0.5rem;
            }
        }
    `;
    document.head.appendChild(additionalStyles);
    
    // تهيئة التطبيق
    SmartContactApp.init();
    
    // لجعل التطبيق متاحاً عالمياً
    window.SmartContactApp = SmartContactApp;
});