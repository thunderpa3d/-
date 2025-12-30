// ========== مكتبة الأدوات المساعدة ==========

class Utils {
    // تنسيق الأرقام
    static formatPhoneNumber(phone) {
        if (!phone) return '';
        
        // إزالة كل شيء إلا الأرقام وعلامة +
        let cleaned = phone.toString().replace(/[^\d+]/g, '');
        
        // معالجة الأرقام السورية
        if (cleaned.startsWith('0')) {
            cleaned = '+963' + cleaned.substring(1);
        } else if (cleaned.startsWith('00')) {
            cleaned = '+' + cleaned.substring(2);
        }
        
        // التحقق من صحة الرقم
        const phoneRegex = /^[\+]?[1-9]\d{1,14}$/;
        if (!phoneRegex.test(cleaned) || cleaned.length < 10) {
            return '';
        }
        
        // تنسيق الرقم للعرض
        if (cleaned.startsWith('+963')) {
            const number = cleaned.substring(4);
            return `+963 ${number.substring(0, 2)} ${number.substring(2, 5)} ${number.substring(5)}`;
        }
        
        return cleaned;
    }
    
    // تنظيف اسم مستخدم التليجرام
    static cleanTelegramUsername(username) {
        if (!username) return '';
        
        return username.toString()
            .replace(/^@+/, '')
            .replace(/[^a-zA-Z0-9_]/g, '')
            .trim();
    }
    
    // نسخ النص للحافظة
    static async copyToClipboard(text, label = 'النص') {
        if (!text) return false;
        
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (error) {
            // طريقة احتياطية
            try {
                const textArea = document.createElement('textarea');
                textArea.value = text;
                textArea.style.position = 'fixed';
                textArea.style.opacity = '0';
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
                return true;
            } catch (fallbackError) {
                console.error('Failed to copy text:', fallbackError);
                return false;
            }
        }
    }
    
    // تحميل صورة الملف
    static loadFileAsDataURL(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }
    
    // تحميل ملف Excel
    static parseExcelFile(arrayBuffer) {
        try {
            const workbook = XLSX.read(arrayBuffer, { type: 'array' });
            
            if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
                throw new Error('ملف Excel لا يحتوي على أوراق');
            }
            
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            return XLSX.utils.sheet_to_json(worksheet, { 
                defval: '',
                raw: false
            });
        } catch (error) {
            console.error('Excel parsing error:', error);
            throw error;
        }
    }
    
    // تحديد أسماء الأعمدة في ملف Excel
    static detectColumnNames(row) {
        const mappings = {
            name: ['الاسم', 'name', 'اسم', 'اسم الجهة', 'جهة الاتصال', 'contact_name'],
            lastName: ['اللقب', 'lastname', 'last name', 'لقب', 'الكنية', 'family_name'],
            phone: ['رقم الهاتف', 'phone', 'هاتف', 'تلفون', 'جوال', 'mobile', 'telephone'],
            whatsapp: ['واتساب', 'whatsapp', 'رقم الواتساب', 'WhatsApp', 'whatsapp_number'],
            telegram: ['تليجرام', 'telegram', 'تيليجرام', 'حساب التليجرام', 'telegram_username'],
            department: ['القسم', 'department', 'الادارة', 'الإدارة', 'section'],
            notes: ['ملاحظات', 'notes', 'تفاصيل', 'remarks']
        };
        
        return mappings;
    }
    
    // البحث عن قيمة في صف Excel
    static findValueInRow(row, keys) {
        if (!row || typeof row !== 'object') return '';
        
        for (const key of keys) {
            const foundKey = Object.keys(row).find(k => 
                this.normalizeText(k) === this.normalizeText(key)
            );
            
            if (foundKey && row[foundKey] !== null && row[foundKey] !== undefined && row[foundKey] !== '') {
                const value = String(row[foundKey]).trim();
                if (value && value !== 'undefined' && value !== 'null') {
                    return value;
                }
            }
        }
        
        return '';
    }
    
    // تطبيع النص للبحث
    static normalizeText(text) {
        if (!text) return '';
        
        return text.toString()
            .toLowerCase()
            .replace(/\s+/g, '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[،]/g, '');
    }
    
    // الهروب من HTML
    static escapeHtml(text) {
        if (text === null || text === undefined) return '';
        
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    // توليد ID فريد
    static generateId(prefix = 'id') {
        return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    // تأخير التنفيذ
    static delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    // التحقق من اتصال الإنترنت
    static checkInternetConnection() {
        return navigator.onLine;
    }
    
    // الحصول على حجم البيانات المخزنة
    static getLocalStorageSize() {
        let total = 0;
        for (let key in localStorage) {
            if (localStorage.hasOwnProperty(key)) {
                total += localStorage[key].length * 2; // كل حرف = 2 بايت
            }
        }
        return total;
    }
    
    // تنسيق حجم الملف
    static formatFileSize(bytes) {
        if (bytes === 0) return '0 بايت';
        
        const k = 1024;
        const sizes = ['بايت', 'كيلوبايت', 'ميجابايت', 'جيجابايت'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    // تحويل التاريخ العربي
    static formatArabicDate(date) {
        const options = {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        };
        
        return new Date(date).toLocaleDateString('ar-SA', options);
    }
    
    // Debounce
    static debounce(func, wait) {
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
    
    // Throttle
    static throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }
}

// تصدير الأدوات
window.Utils = Utils;