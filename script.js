// تطبيق دليل الاتصال الذكي - إصدار مُحسّن ومهني
class SmartContactApp {
    constructor() {
        this.contacts = [];
        this.filteredContacts = [];
        this.config = {
            githubUrl: 'https://raw.githubusercontent.com/thunderpa3d/-/main/CONTACTS.xlsx',
            syncInterval: 300000, // 5 دقائق
            maxRetries: 3,
            retryDelay: 2000
        };
        
        this.isLoading = false;
        this.retryCount = 0;
        
        this.init();
    }

    init() {
        this.cacheElements();
        this.bindEvents();
        this.initScrollHeader();
        this.loadApp();
        this.startAutoSync();
    }

    cacheElements() {
        const elements = {
            contactsContainer: document.getElementById('contactsContainer'),
            searchInput: document.getElementById('searchInput'),
            notificationCenter: document.getElementById('notificationCenter'),
            loadingOverlay: document.getElementById('loadingOverlay'),
            manualSync: document.getElementById('manualSync'),
            contactsCount: document.getElementById('contactsCount'),
            searchClear: document.querySelector('.header-search-clear'),
            appHeader: document.querySelector('.app-header')
        };

        // التحقق من وجود جميع العناصر
        for (const [key, element] of Object.entries(elements)) {
            if (!element) {
                console.error(`Element not found: ${key}`);
                throw new Error(`Missing required element: ${key}`);
            }
        }

        this.elements = elements;
    }

    bindEvents() {
        // البحث مع Debounce
        this.elements.searchInput.addEventListener('input', 
            this.debounce(() => this.searchContacts(), 300)
        );

        this.elements.searchClear.addEventListener('click', () => {
            this.elements.searchInput.value = '';
            this.searchContacts();
            this.elements.searchInput.focus();
        });

        // المزامنة اليدوية
        this.elements.manualSync.addEventListener('click', 
            () => this.syncWithGitHub()
        );

        // اكتشاف حالة الاتصال
        window.addEventListener('online', () => {
            this.showNotification('متصل بالإنترنت - جاري المزامنة...', 'info');
            setTimeout(() => this.syncWithGitHub(), 1000);
        });

        window.addEventListener('offline', () => {
            this.showNotification('غير متصل بالإنترنت', 'warning');
        });

        // إغلاق الإشعارات عند النقر
        this.elements.notificationCenter.addEventListener('click', (e) => {
            if (e.target.closest('.notification')) {
                e.target.closest('.notification').remove();
            }
        });
    }

    initScrollHeader() {
        this.lastScrollY = window.scrollY;
        this.headerHeight = this.elements.appHeader.offsetHeight;
        
        window.addEventListener('scroll', 
            this.throttle(() => this.handleScroll(), 100)
        );
    }

    handleScroll() {
        const currentScrollY = window.scrollY;
        const scrollDelta = currentScrollY - this.lastScrollY;

        if (currentScrollY <= 0) {
            // أعلى الصفحة - إظهار الهيدر
            this.elements.appHeader.style.transform = 'translateY(0)';
        } else if (scrollDelta > 5 && currentScrollY > this.headerHeight) {
            // التمرير للأسفل - إخفاء الهيدر
            this.elements.appHeader.style.transform = 'translateY(-100%)';
        } else if (scrollDelta < -5) {
            // التمرير للأعلى - إظهار الهيدر
            this.elements.appHeader.style.transform = 'translateY(0)';
        }

        this.lastScrollY = currentScrollY;
    }

    async loadApp() {
        if (this.isLoading) return;
        
        this.showLoading();
        
        try {
            await this.loadContacts();
            this.renderContacts();
            
            if (navigator.onLine) {
                setTimeout(() => this.syncWithGitHub(), 1500);
            }
        } catch (error) {
            console.error('App load error:', error);
            this.showNotification('خطأ في تحميل التطبيق', 'error');
        } finally {
            this.hideLoading();
        }
    }

    async loadContacts() {
        try {
            const savedContacts = localStorage.getItem('smartContactApp');
            const timestamp = localStorage.getItem('smartContactApp_timestamp');
            
            if (savedContacts) {
                this.contacts = JSON.parse(savedContacts);
                this.filteredContacts = [...this.contacts];
                this.updateContactsCount();
                
                const age = timestamp ? Date.now() - parseInt(timestamp) : Infinity;
                if (age > this.config.syncInterval) {
                    this.showNotification('جاري تحديث البيانات...', 'info');
                } else {
                    this.showNotification('تم تحميل البيانات المحلية', 'success');
                }
            }
        } catch (error) {
            console.error('Load contacts error:', error);
            throw new Error('فشل تحميل البيانات المحلية');
        }
    }

    async syncWithGitHub(force = false) {
        if (!navigator.onLine) {
            this.showNotification('غير متصل بالإنترنت', 'warning');
            return false;
        }

        if (this.isLoading && !force) {
            this.showNotification('جاري المزامنة بالفعل...', 'info');
            return false;
        }

        this.isLoading = true;
        this.showNotification('جاري المزامنة مع الخادم...', 'info');

        try {
            const response = await this.fetchWithTimeout(this.config.githubUrl, {
                timeout: 10000,
                retries: this.config.maxRetries
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const arrayBuffer = await response.arrayBuffer();
            
            if (arrayBuffer.byteLength === 0) {
                throw new Error('الملف المستلم فارغ');
            }

            const workbook = XLSX.read(arrayBuffer, { type: 'array' });
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
            
            if (!jsonData || jsonData.length === 0) {
                throw new Error('الملف لا يحتوي على بيانات صالحة');
            }
            
            const processedData = this.processExcelData(jsonData);
            
            if (processedData.length === 0) {
                throw new Error('لا توجد جهات اتصال صالحة بعد المعالجة');
            }

            this.contacts = processedData;
            this.saveToLocalStorage();
            this.filteredContacts = [...this.contacts];
            this.renderContacts();
            
            this.retryCount = 0;
            this.showNotification(`تم تحديث ${this.contacts.length} جهة اتصال`, 'success');
            return true;

        } catch (error) {
            console.error('Sync error:', error);
            
            this.retryCount++;
            if (this.retryCount <= this.config.maxRetries) {
                this.showNotification(`محاولة مزامنة أخرى (${this.retryCount}/${this.config.maxRetries})`, 'warning');
                setTimeout(() => this.syncWithGitHub(), this.config.retryDelay);
            } else {
                this.showNotification('فشلت المزامنة - استخدام البيانات المحلية', 'error');
            }
            return false;
        } finally {
            this.isLoading = false;
        }
    }

    async fetchWithTimeout(url, options = {}) {
        const { timeout = 10000, retries = 1 } = options;
        
        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), timeout);
                
                const response = await fetch(url, {
                    signal: controller.signal,
                    headers: {
                        'Cache-Control': 'no-cache',
                        'Pragma': 'no-cache'
                    }
                });
                
                clearTimeout(timeoutId);
                return response;
            } catch (error) {
                if (attempt === retries) throw error;
                await this.delay(this.config.retryDelay);
            }
        }
    }

    processExcelData(jsonData) {
        const columnMappings = {
            name: ['الاسم', 'name', 'اسم', 'اسم الجهة'],
            lastName: ['اللقب', 'lastname', 'last name', 'لقب', 'الكنية'],
            phone: ['رقم الهاتف', 'phone', 'هاتف', 'تلفون', 'جوال'],
            whatsapp: ['واتساب', 'whatsapp', 'رقم الواتساب'],
            telegram: ['تليجرام', 'telegram', 'تيليجرام', 'حساب التليجرام'],
            address: ['العنوان', 'address', 'عنوان', 'موقع']
        };

        return jsonData
            .map((row, index) => {
                const findValue = (keys) => {
                    for (const key of keys) {
                        const foundKey = Object.keys(row).find(k => 
                            this.normalizeText(k) === this.normalizeText(key)
                        );
                        if (foundKey && row[foundKey] !== null && row[foundKey] !== undefined && row[foundKey] !== '') {
                            return String(row[foundKey]).trim();
                        }
                    }
                    return '';
                };

                const contact = {
                    id: `contact-${Date.now()}-${index}`,
                    name: findValue(columnMappings.name),
                    lastName: findValue(columnMappings.lastName),
                    phone: this.cleanPhoneNumber(findValue(columnMappings.phone)),
                    whatsapp: this.cleanPhoneNumber(findValue(columnMappings.whatsapp)),
                    telegram: this.cleanTelegramUsername(findValue(columnMappings.telegram)),
                    address: findValue(columnMappings.address)
                };

                return contact;
            })
            .filter(contact => 
                contact.name || contact.lastName || contact.phone || contact.whatsapp
            );
    }

    normalizeText(text) {
        return text.toString().toLowerCase().replace(/\s+/g, '').replace(/[َُِّ]/g, '');
    }

    cleanPhoneNumber(phone) {
        if (!phone) return '';
        // إزالة جميع الأحرف غير الرقمية باستثناء علامة +
        return phone.replace(/[^\d+]/g, '');
    }

    cleanTelegramUsername(username) {
        if (!username) return '';
        // إزالة @ من بداية اسم المستخدم
        return username.replace(/^@+/, '');
    }

    searchContacts() {
        const searchTerm = this.elements.searchInput.value.trim();
        
        if (!searchTerm) {
            this.filteredContacts = [...this.contacts];
        } else {
            const normalizedSearch = this.normalizeText(searchTerm);
            
            this.filteredContacts = this.contacts.filter(contact => {
                const searchFields = [
                    contact.name,
                    contact.lastName,
                    contact.phone,
                    contact.whatsapp,
                    contact.telegram,
                    contact.address
                ].filter(Boolean);

                return searchFields.some(field => 
                    this.normalizeText(field).includes(normalizedSearch)
                );
            });
        }
        
        this.renderContacts();
    }

    renderContacts() {
        const container = this.elements.contactsContainer;
        
        if (!container) {
            console.error('Contacts container not found');
            return;
        }

        if (this.filteredContacts.length === 0) {
            container.innerHTML = this.getEmptyStateHTML();
        } else {
            container.innerHTML = this.filteredContacts
                .map(contact => this.getContactCardHTML(contact))
                .join('');
        }
        
        this.updateContactsCount();
    }

    getContactCardHTML(contact) {
        const firstLetter = (contact.name || contact.lastName || '?').charAt(0).toUpperCase();
        const displayName = `${contact.name || ''} ${contact.lastName || ''}`.trim() || 'بدون اسم';
        
        return `
        <div class="contact-card" data-contact-id="${contact.id}">
            <div class="contact-avatar" aria-label="صورة ${displayName}">
                ${firstLetter}
            </div>
            
            <div class="contact-info-horizontal">
                <h3 class="contact-name">${this.escapeHtml(displayName)}</h3>
                <div class="contact-details-grid">
                    ${this.getContactFieldHTML('fas fa-phone', contact.phone, 'رقم الهاتف')}
                    ${this.getContactFieldHTML('fab fa-whatsapp', contact.whatsapp, 'رقم الواتساب')}
                    ${this.getContactFieldHTML('fab fa-telegram', contact.telegram, 'حساب التليجرام', '@' + contact.telegram)}
                    ${this.getContactFieldHTML('fas fa-map-marker-alt', contact.address, 'العنوان')}
                </div>
            </div>
            
            <div class="contact-actions-horizontal">
                ${this.getActionButtonHTML('call', 'اتصال', 'fas fa-phone', contact.phone)}
                ${this.getActionButtonHTML('whatsapp', 'واتساب', 'fab fa-whatsapp', contact.whatsapp)}
                ${this.getActionButtonHTML('telegram', 'تيليجرام', 'fab fa-telegram', contact.telegram)}
            </div>
        </div>
        `;
    }

    getContactFieldHTML(icon, value, label, displayValue = null) {
        if (!value) return '';
        
        const display = displayValue || value;
        return `
        <div class="contact-field-horizontal">
            <i class="${icon}" aria-hidden="true"></i>
            <div class="contact-field-content">
                <span>${this.escapeHtml(display)}</span>
                <button class="copy-btn-small" 
                        onclick="app.copyToClipboard('${this.escapeHtml(value)}', '${label}')"
                        aria-label="نسخ ${label}">
                    <i class="fas fa-copy"></i>
                </button>
            </div>
        </div>
        `;
    }

    getActionButtonHTML(type, text, icon, value) {
        const isDisabled = !value;
        const ariaLabel = isDisabled ? `${text} غير متاح` : `${text} ${this.getActionLabel(type, value)}`;
        
        return `
        <button class="action-btn-horizontal ${type} ${isDisabled ? 'disabled' : ''}" 
                ${isDisabled ? 'disabled' : `onclick="app.handleAction('${type}', '${this.escapeHtml(value)}')"`}
                aria-label="${ariaLabel}">
            <i class="${icon}"></i>
            <span>${text}</span>
        </button>
        `;
    }

    getActionLabel(type, value) {
        switch (type) {
            case 'call': return `للاتصال بالرقم ${value}`;
            case 'whatsapp': return `للاتصال عبر واتساب بالرقم ${value}`;
            case 'telegram': return `للاتصال عبر تيليجرام باسم ${value}`;
            default: return '';
        }
    }

    getEmptyStateHTML() {
        const hasSearch = this.elements.searchInput.value.trim();
        
        return `
        <div class="empty-state">
            <i class="fas fa-${hasSearch ? 'search' : 'users'}" 
               aria-hidden="true"></i>
            <h3>${hasSearch ? 'لا توجد نتائج' : 'لا توجد جهات اتصال'}</h3>
            <p>${hasSearch ? 'جرب مصطلحات بحث مختلفة' : 'قم بالمزامنة لتحميل جهات الاتصال'}</p>
            ${!hasSearch ? `<button class="sync-btn-large" onclick="app.syncWithGitHub(true)">
                <i class="fas fa-sync"></i> مزامنة الآن
            </button>` : ''}
        </div>
        `;
    }

    handleAction(type, value) {
        if (!value) return;

        try {
            switch (type) {
                case 'call':
                    this.callNumber(value);
                    break;
                case 'whatsapp':
                    this.openWhatsApp(value);
                    break;
                case 'telegram':
                    this.openTelegram(value);
                    break;
            }
            
            // تسجيل النشاط
            this.logAction(type, value);
        } catch (error) {
            console.error('Action error:', error);
            this.showNotification('فشل تنفيذ الإجراء', 'error');
        }
    }

    callNumber(phone) {
        const telLink = `tel:${phone}`;
        window.open(telLink, '_self');
    }

    openWhatsApp(whatsapp) {
        const cleanNumber = whatsapp.replace(/[^\d+]/g, '');
        const whatsappUrl = `https://wa.me/${cleanNumber}`;
        window.open(whatsappUrl, '_blank');
    }

    openTelegram(telegram) {
        const cleanUsername = telegram.replace(/[@]/g, '');
        const telegramUrl = `https://t.me/${cleanUsername}`;
        window.open(telegramUrl, '_blank');
    }

    async copyToClipboard(text, label) {
        if (!text) return;

        try {
            await navigator.clipboard.writeText(text);
            this.showNotification(`تم نسخ ${label}`, 'success', 2000);
        } catch (error) {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'fixed';
            textArea.style.opacity = '0';
            document.body.appendChild(textArea);
            textArea.select();
            
            try {
                document.execCommand('copy');
                this.showNotification(`تم نسخ ${label}`, 'success', 2000);
            } catch (fallbackError) {
                this.showNotification('فشل نسخ النص', 'error');
            } finally {
                document.body.removeChild(textArea);
            }
        }
    }

    updateContactsCount() {
        if (this.elements.contactsCount) {
            const total = this.contacts.length;
            const filtered = this.filteredContacts.length;
            const countText = total === filtered ? 
                `${total} جهة اتصال` : 
                `${filtered} من ${total} جهة اتصال`;
            
            this.elements.contactsCount.textContent = countText;
        }
    }

    showNotification(message, type = 'info', duration = 5000) {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.setAttribute('role', 'alert');
        notification.setAttribute('aria-live', 'polite');
        
        notification.innerHTML = `
            <i class="fas fa-${this.getNotificationIcon(type)}"></i>
            <div>${message}</div>
            <button class="notification-close" onclick="this.parentElement.remove()" aria-label="إغلاق">
                <i class="fas fa-times"></i>
            </button>
        `;

        this.elements.notificationCenter.appendChild(notification);
        
        // إضافة animation
        setTimeout(() => notification.classList.add('show'), 10);
        
        // الإزالة التلقائية
        if (duration > 0) {
            setTimeout(() => {
                if (notification.parentElement) {
                    notification.classList.remove('show');
                    setTimeout(() => notification.remove(), 300);
                }
            }, duration);
        }
    }

    getNotificationIcon(type) {
        const icons = {
            success: 'check-circle',
            error: 'exclamation-circle',
            warning: 'exclamation-triangle',
            info: 'info-circle'
        };
        return icons[type] || 'info-circle';
    }

    showLoading() {
        this.elements.loadingOverlay.classList.add('show');
        this.elements.loadingOverlay.setAttribute('aria-hidden', 'false');
    }

    hideLoading() {
        this.elements.loadingOverlay.classList.remove('show');
        this.elements.loadingOverlay.setAttribute('aria-hidden', 'true');
    }

    startAutoSync() {
        setInterval(() => {
            if (navigator.onLine && !this.isLoading) {
                this.syncWithGitHub();
            }
        }, this.config.syncInterval);
    }

    saveToLocalStorage() {
        try {
            localStorage.setItem('smartContactApp', JSON.stringify(this.contacts));
            localStorage.setItem('smartContactApp_timestamp', Date.now().toString());
        } catch (error) {
            console.error('Save to localStorage error:', error);
            this.showNotification('فشل حفظ البيانات محلياً', 'warning');
        }
    }

    logAction(type, value) {
        console.log(`User action: ${type} - ${value}`);
        // يمكن إضافة خدمة تحليلات هنا
    }

    // Utility Methods
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
    }

    throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    escapeHtml(text) {
        if (typeof text !== 'string') return text;
        
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // تنظيف الذاكرة عند إغلاق الصفحة
    destroy() {
        window.removeEventListener('online', this.onlineHandler);
        window.removeEventListener('offline', this.offlineHandler);
        this.isLoading = false;
    }
}

// تهيئة التطبيق عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', () => {
    try {
        window.app = new SmartContactApp();
        
        // تنظيف عند إغلاق الصفحة
        window.addEventListener('beforeunload', () => {
            if (window.app && typeof window.app.destroy === 'function') {
                window.app.destroy();
            }
        });
    } catch (error) {
        console.error('Failed to initialize app:', error);
        document.body.innerHTML = `
            <div style="padding: 2rem; text-align: center; color: #ef4444;">
                <h2>خطأ في تحميل التطبيق</h2>
                <p>حدث خطأ غير متوقع. يرجى تحديث الصفحة.</p>
                <button onclick="window.location.reload()" style="padding: 0.5rem 1rem; margin-top: 1rem;">
                    تحديث الصفحة
                </button>
            </div>
        `;
    }
});
