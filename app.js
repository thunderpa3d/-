// ========== التطبيق الرئيسي المنظم ==========
class SmartContactApp {
    constructor() {
        this.config = {
            appName: 'دليل الاتصال الذكي',
            version: '2.0.1',
            dataSources: [
                {
                    id: 'primary',
                    name: 'المصدر الرئيسي',
                    url: 'https://raw.githubusercontent.com/thunderpa3d/-/main/CONTACTS.xlsx',
                    enabled: true
                },
                {
                    id: 'backup',
                    name: 'المصدر الاحتياطي',
                    url: 'https://raw.githubusercontent.com/thunderpa3d/-/main/contacts.xlsx',
                    enabled: true
                }
            ],
            sync: {
                interval: 300000, // 5 دقائق
                auto: true,
                retryAttempts: 3,
                retryDelay: 2000
            },
            cache: {
                enabled: true,
                duration: 3600000, // ساعة واحدة
                maxSize: 1024 * 1024 * 10 // 10MB
            }
        };
        
        this.state = {
            contacts: [],
            filteredContacts: [],
            isLoading: false,
            isOnline: navigator.onLine,
            lastSync: null,
            currentView: 'grid',
            searchQuery: '',
            selectedContacts: new Set()
        };
        
        this.modules = {
            auth: null,
            contacts: null,
            ui: null,
            sync: null
        };
        
        this.init();
    }
    
    async init() {
        try {
            this.showLoading('جاري تهيئة التطبيق...');
            
            // تهيئة الأنظمة الفرعية
            await this.initSubsystems();
            
            // تحميل البيانات
            await this.loadData();
            
            // إعداد واجهة المستخدم
            this.setupUI();
            
            // بدء الخدمات
            this.startServices();
            
            this.hideLoading();
            
            this.showNotification('✅ تم تحميل التطبيق بنجاح', 'success');
            
        } catch (error) {
            console.error('فشل تهيئة التطبيق:', error);
            this.showNotification('❌ فشل تحميل التطبيق', 'error');
            this.hideLoading();
        }
    }
    
    async initSubsystems() {
        // نظام المصادقة
        if (window.AuthSystem) {
            this.modules.auth = new window.AuthSystem();
        }
        
        // نظام جهات الاتصال
        if (window.ContactsManager) {
            this.modules.contacts = new window.ContactsManager({
                onUpdate: this.onContactsUpdate.bind(this)
            });
        }
        
        // نظام المزامنة
        this.modules.sync = {
            start: () => this.startSyncService(),
            stop: () => this.stopSyncService(),
            manual: () => this.manualSync()
        };
        
        // نظام واجهة المستخدم
        this.modules.ui = this.setupUIModule();
    }
    
    async loadData() {
        // محاولة تحميل البيانات المخزنة محلياً
        const cachedData = this.loadFromCache();
        
        if (cachedData) {
            this.state.contacts = cachedData.contacts;
            this.state.lastSync = cachedData.timestamp;
            this.updateUI();
            
            // إذا كان هناك اتصال، قم بالمزامنة في الخلفية
            if (this.state.isOnline) {
                setTimeout(() => this.backgroundSync(), 2000);
            }
        } else {
            // تحميل البيانات للمرة الأولى
            await this.performSync();
        }
    }
    
    setupUI() {
        // إعداد البحث
        this.setupSearch();
        
        // إعداد الأزرار
        this.setupButtons();
        
        // إعداد الإشعارات
        this.setupNotifications();
        
        // تحديث الواجهة
        this.updateUI();
        
        // إضافة مستمعي الأحداث
        this.addEventListeners();
    }
    
    setupSearch() {
        const searchInput = document.getElementById('search-input');
        const searchClear = document.getElementById('search-clear');
        
        if (searchInput) {
            searchInput.addEventListener('input', debounce((e) => {
                this.state.searchQuery = e.target.value.trim();
                this.filterContacts();
                
                // إظهار/إخفاء زر المسح
                if (searchClear) {
                    searchClear.style.display = this.state.searchQuery ? 'flex' : 'none';
                }
            }, 300));
        }
        
        if (searchClear) {
            searchClear.addEventListener('click', () => {
                if (searchInput) {
                    searchInput.value = '';
                    this.state.searchQuery = '';
                    this.filterContacts();
                    searchClear.style.display = 'none';
                    searchInput.focus();
                }
            });
        }
    }
    
    setupButtons() {
        // زر المزامنة اليدوية
        const manualSyncBtn = document.getElementById('manual-sync');
        if (manualSyncBtn) {
            manualSyncBtn.addEventListener('click', () => this.manualSync());
        }
        
        // زر التصدير
        const exportBtn = document.getElementById('export-contacts');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportContacts());
        }
        
        // زر الإعدادات
        const settingsBtn = document.getElementById('app-settings');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => this.openSettings());
        }
        
        // أزرار تغيير العرض
        const viewButtons = document.querySelectorAll('.view-btn');
        viewButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const view = btn.dataset.view;
                this.changeView(view);
            });
        });
    }
    
    async manualSync() {
        if (this.state.isLoading) {
            this.showNotification('⚠️ جاري المزامنة بالفعل', 'warning');
            return;
        }
        
        if (!this.state.isOnline) {
            this.showNotification('❌ لا يوجد اتصال بالإنترنت', 'error');
            return;
        }
        
        this.showLoading('جاري المزامنة مع الخادم...');
        
        try {
            await this.performSync();
            this.showNotification('✅ تمت المزامنة بنجاح', 'success');
        } catch (error) {
            this.showNotification('❌ فشلت المزامنة', 'error');
        } finally {
            this.hideLoading();
        }
    }
    
    async performSync() {
        this.state.isLoading = true;
        
        try {
            // هنا سيتم استدعاء نظام جهات الاتصال للمزامنة
            if (this.modules.contacts && typeof this.modules.contacts.sync === 'function') {
                const result = await this.modules.contacts.sync();
                
                if (result.success) {
                    this.state.contacts = result.data;
                    this.state.lastSync = Date.now();
                    this.saveToCache();
                    this.filterContacts();
                    this.updateStats();
                }
            }
            
            return true;
        } catch (error) {
            console.error('فشل المزامنة:', error);
            throw error;
        } finally {
            this.state.isLoading = false;
        }
    }
    
    filterContacts() {
        const query = this.state.searchQuery.toLowerCase();
        
        if (!query) {
            this.state.filteredContacts = [...this.state.contacts];
        } else {
            this.state.filteredContacts = this.state.contacts.filter(contact => {
                const searchable = [
                    contact.name,
                    contact.lastName,
                    contact.phone,
                    contact.whatsapp,
                    contact.telegram,
                    contact.department,
                    contact.notes
                ].filter(Boolean).join(' ').toLowerCase();
                
                return searchable.includes(query);
            });
        }
        
        this.renderContacts();
    }
    
    renderContacts() {
        const container = document.getElementById('contacts-container');
        
        if (!container) return;
        
        if (this.state.filteredContacts.length === 0) {
            container.innerHTML = this.getEmptyStateHTML();
            return;
        }
        
        if (this.state.currentView === 'grid') {
            container.className = 'contacts-grid';
            container.innerHTML = this.state.filteredContacts
                .map(contact => this.renderContactCard(contact))
                .join('');
        } else {
            container.className = 'contacts-list';
            container.innerHTML = this.state.filteredContacts
                .map(contact => this.renderContactRow(contact))
                .join('');
        }
        
        // إضافة مستمعي الأحداث للبطاقات
        this.attachContactEvents();
    }
    
    renderContactCard(contact) {
        // ... رمز عرض البطاقة
        return `
        <div class="contact-card" data-id="${contact.id}">
            <!-- تصميم البطاقة -->
        </div>
        `;
    }
    
    updateUI() {
        // تحديث العداد
        this.updateCounter();
        
        // تحديث الإحصائيات
        this.updateStats();
        
        // تحديث وقت المزامنة
        this.updateSyncTime();
    }
    
    updateCounter() {
        const counter = document.getElementById('contacts-count');
        if (counter) {
            const total = this.state.contacts.length;
            const filtered = this.state.filteredContacts.length;
            
            if (total === filtered) {
                counter.textContent = `${total} جهة اتصال`;
            } else {
                counter.textContent = `${filtered} من ${total} جهة اتصال`;
            }
        }
    }
    
    updateStats() {
        // تحديث بطاقات الإحصائيات
        const totalEl = document.getElementById('total-contacts');
        const phonesEl = document.getElementById('total-phones');
        const whatsappEl = document.getElementById('total-whatsapp');
        const telegramEl = document.getElementById('total-telegram');
        
        if (totalEl) totalEl.textContent = this.state.contacts.length;
        if (phonesEl) phonesEl.textContent = this.state.contacts.filter(c => c.phone).length;
        if (whatsappEl) whatsappEl.textContent = this.state.contacts.filter(c => c.whatsapp).length;
        if (telegramEl) telegramEl.textContent = this.state.contacts.filter(c => c.telegram).length;
    }
    
    updateSyncTime() {
        const syncEl = document.getElementById('last-sync');
        if (syncEl && this.state.lastSync) {
            const time = new Date(this.state.lastSync);
            syncEl.textContent = `آخر تحديث: ${time.toLocaleTimeString('ar-SA')}`;
        }
    }
    
    // ========== دوال المساعدة ==========
    
    showLoading(message = 'جاري التحميل...') {
        const overlay = document.getElementById('loading-overlay');
        const text = document.getElementById('loading-text');
        
        if (overlay) {
            overlay.style.display = 'flex';
            if (text) text.textContent = message;
        }
    }
    
    hideLoading() {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            setTimeout(() => {
                overlay.style.display = 'none';
            }, 300);
        }
    }
    
    showNotification(message, type = 'info', duration = 5000) {
        const center = document.getElementById('notification-center');
        
        if (!center) return;
        
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        
        const icons = {
            success: 'fas fa-check-circle',
            error: 'fas fa-exclamation-circle',
            warning: 'fas fa-exclamation-triangle',
            info: 'fas fa-info-circle'
        };
        
        notification.innerHTML = `
            <i class="${icons[type] || icons.info}"></i>
            <span>${message}</span>
            <button class="notification-close">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        center.appendChild(notification);
        
        // إضافة تأثير الظهور
        setTimeout(() => notification.classList.add('show'), 10);
        
        // إغلاق عند النقر
        notification.querySelector('.notification-close').addEventListener('click', () => {
            notification.remove();
        });
        
        // إغلاق تلقائي
        if (duration > 0) {
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.classList.remove('show');
                    setTimeout(() => notification.remove(), 300);
                }
            }, duration);
        }
    }
    
    saveToCache() {
        if (!this.config.cache.enabled) return;
        
        const cacheData = {
            contacts: this.state.contacts,
            timestamp: this.state.lastSync,
            version: this.config.version
        };
        
        try {
            localStorage.setItem('contactAppCache', JSON.stringify(cacheData));
        } catch (error) {
            console.warn('تعذر حفظ البيانات في الذاكرة المؤقتة:', error);
        }
    }
    
    loadFromCache() {
        if (!this.config.cache.enabled) return null;
        
        try {
            const cached = localStorage.getItem('contactAppCache');
            if (!cached) return null;
            
            const data = JSON.parse(cached);
            
            // التحقق من صلاحية البيانات
            if (!data.timestamp || !data.contacts) return null;
            
            const cacheAge = Date.now() - data.timestamp;
            if (cacheAge > this.config.cache.duration) return null;
            
            return data;
        } catch (error) {
            return null;
        }
    }
    
    clearCache() {
        localStorage.removeItem('contactAppCache');
    }
    
    startServices() {
        // خدمة المزامنة التلقائية
        if (this.config.sync.auto) {
            this.syncInterval = setInterval(() => {
                if (this.state.isOnline && !this.state.isLoading) {
                    this.backgroundSync();
                }
            }, this.config.sync.interval);
        }
        
        // مراقبة حالة الاتصال
        window.addEventListener('online', () => {
            this.state.isOnline = true;
            this.showNotification('✅ تم استعادة الاتصال بالإنترنت', 'success');
            
            // تحديث حالة الاتصال في الواجهة
            const statusEl = document.querySelector('.status-indicator');
            if (statusEl) statusEl.className = 'status-indicator online';
        });
        
        window.addEventListener('offline', () => {
            this.state.isOnline = false;
            this.showNotification('⚠️ فقدان الاتصال بالإنترنت', 'warning');
            
            // تحديث حالة الاتصال في الواجهة
            const statusEl = document.querySelector('.status-indicator');
            if (statusEl) statusEl.className = 'status-indicator offline';
        });
    }
    
    backgroundSync() {
        if (!this.state.isOnline || this.state.isLoading) return;
        
        this.performSync().catch(error => {
            console.warn('فشلت المزامنة في الخلفية:', error);
        });
    }
    
    // ========== الأحداث ==========
    
    addEventListeners() {
        // اختصارات لوحة المفاتيح
        document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + F للبحث
            if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
                e.preventDefault();
                const searchInput = document.getElementById('search-input');
                if (searchInput) searchInput.focus();
            }
            
            // ESC لمسح البحث
            if (e.key === 'Escape') {
                const searchInput = document.getElementById('search-input');
                if (searchInput && searchInput.value) {
                    searchInput.value = '';
                    this.state.searchQuery = '';
                    this.filterContacts();
                }
            }
        });
    }
    
    onContactsUpdate(contacts) {
        this.state.contacts = contacts;
        this.filterContacts();
        this.updateUI();
        this.saveToCache();
    }
    
    changeView(view) {
        if (view === this.state.currentView) return;
        
        this.state.currentView = view;
        
        // تحديث أزرار العرض
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === view);
        });
        
        // إعادة عرض الجهات
        this.renderContacts();
    }
    
    // ========== الإعدادات ==========
    
    openSettings() {
        // فتح نافذة الإعدادات
        const modal = document.getElementById('settings-modal');
        if (modal) {
            modal.style.display = 'block';
            this.populateSettings();
        }
    }
    
    populateSettings() {
        // ملء نافذة الإعدادات
        const modalBody = document.querySelector('#settings-modal .modal-body');
        
        if (!modalBody) return;
        
        modalBody.innerHTML = `
            <div class="settings-section">
                <h3><i class="fas fa-sync"></i> إعدادات المزامنة</h3>
                <div class="setting-item">
                    <label class="switch">
                        <input type="checkbox" id="auto-sync" ${this.config.sync.auto ? 'checked' : ''}>
                        <span class="slider"></span>
                    </label>
                    <span class="setting-label">المزامنة التلقائية</span>
                </div>
                
                <div class="setting-item">
                    <label>فترة المزامنة (دقائق)</label>
                    <input type="number" id="sync-interval" value="${this.config.sync.interval / 60000}" min="1" max="60">
                </div>
            </div>
            
            <div class="settings-section">
                <h3><i class="fas fa-database"></i> إعدادات التخزين</h3>
                <div class="setting-item">
                    <label class="switch">
                        <input type="checkbox" id="cache-enabled" ${this.config.cache.enabled ? 'checked' : ''}>
                        <span class="slider"></span>
                    </label>
                    <span class="setting-label">تفعيل التخزين المؤقت</span>
                </div>
                
                <button class="btn btn-secondary" id="clear-cache">
                    <i class="fas fa-trash"></i> مسح البيانات المخزنة
                </button>
            </div>
            
            <div class="settings-section">
                <h3><i class="fas fa-eye"></i> إعدادات العرض</h3>
                <div class="setting-item">
                    <label>وضع العرض الافتراضي</label>
                    <select id="default-view">
                        <option value="grid" ${this.state.currentView === 'grid' ? 'selected' : ''}>بطاقات</option>
                        <option value="list" ${this.state.currentView === 'list' ? 'selected' : ''}>قائمة</option>
                    </select>
                </div>
            </div>
            
            <div class="settings-actions">
                <button class="btn btn-primary" id="save-settings">
                    <i class="fas fa-save"></i> حفظ التغييرات
                </button>
                <button class="btn btn-secondary" id="reset-settings">
                    <i class="fas fa-undo"></i> إعادة تعيين
                </button>
            </div>
        `;
        
        // إضافة مستمعي الأحداث للإعدادات
        this.attachSettingsEvents();
    }
    
    attachSettingsEvents() {
        // حفظ الإعدادات
        const saveBtn = document.getElementById('save-settings');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.saveSettings());
        }
        
        // مسح الذاكرة المؤقتة
        const clearBtn = document.getElementById('clear-cache');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                if (confirm('هل أنت متأكد من مسح جميع البيانات المخزنة محليًا؟')) {
                    this.clearCache();
                    this.showNotification('✅ تم مسح البيانات المخزنة', 'success');
                }
            });
        }
        
        // إغلاق النافذة
        const closeBtn = document.querySelector('.modal-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                const modal = document.getElementById('settings-modal');
                if (modal) modal.style.display = 'none';
            });
        }
        
        // إغلاق عند النقر خارج النافذة
        window.addEventListener('click', (e) => {
            const modal = document.getElementById('settings-modal');
            if (modal && e.target === modal) {
                modal.style.display = 'none';
            }
        });
    }
    
    saveSettings() {
        // حفظ الإعدادات الجديدة
        this.config.sync.auto = document.getElementById('auto-sync').checked;
        this.config.sync.interval = document.getElementById('sync-interval').value * 60000;
        this.config.cache.enabled = document.getElementById('cache-enabled').checked;
        
        const defaultView = document.getElementById('default-view').value;
        this.state.currentView = defaultView;
        this.changeView(defaultView);
        
        // إعادة ضبط خدمة المزامنة
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
        }
        
        if (this.config.sync.auto) {
            this.startServices();
        }
        
        this.showNotification('✅ تم حفظ الإعدادات بنجاح', 'success');
        
        // إغلاق النافذة
        const modal = document.getElementById('settings-modal');
        if (modal) modal.style.display = 'none';
    }
    
    exportContacts() {
        if (this.state.contacts.length === 0) {
            this.showNotification('❌ لا توجد جهات اتصال للتصدير', 'warning');
            return;
        }
        
        const data = JSON.stringify(this.state.contacts, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `contacts_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        URL.revokeObjectURL(url);
        
        this.showNotification('✅ تم تصدير الجهات بنجاح', 'success');
    }
    
    getEmptyStateHTML() {
        if (this.state.searchQuery) {
            return `
            <div class="empty-state">
                <i class="fas fa-search"></i>
                <h3>لا توجد نتائج للبحث</h3>
                <p>لم نتمكن من العثور على جهات تطابق "${this.state.searchQuery}"</p>
                <button class="btn btn-secondary" onclick="document.getElementById('search-input').value=''; app.filterContacts();">
                    <i class="fas fa-times"></i> مسح البحث
                </button>
            </div>
            `;
        }
        
        return `
        <div class="empty-state">
            <i class="fas fa-address-book"></i>
            <h3>لا توجد جهات اتصال</h3>
            <p>قم بالمزامنة لتحميل جهات الاتصال</p>
            <button class="btn btn-primary" onclick="app.manualSync()">
                <i class="fas fa-sync"></i> مزامنة الآن
            </button>
        </div>
        `;
    }
}

// ========== تهيئة التطبيق ==========
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 تهيئة دليل الاتصال الذكي...');
    
    // إنشاء تطبيق جديد
    window.app = new SmartContactApp();
    
    // دوال مساعدة عامة
    window.debounce = function(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    };
    
    window.throttle = function(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    };
    
    // تعريف دالة البداية (بدلاً من checkPassword القديمة)
    window.initializeApp = function() {
        if (window.app) {
            window.app.init();
        }
    };
});