/**
 * Pasarela de pago simulada. No cobra dinero real, pero valida la tarjeta
 * con el algoritmo de Luhn, el vencimiento y el CVV antes de aprobar.
 */

export class PaymentError extends Error {
  constructor(message) {
    super(message);
    this.name = 'PaymentError';
    this.status = 400;
  }
}

export class PaymentProvider {
  // Contrato base: cualquier pasarela real debe implementar charge().
  // eslint-disable-next-line no-unused-vars
  async charge(_request) {
    throw new Error('PaymentProvider.charge() debe implementarse.');
  }
}

function onlyDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

function luhnValid(number) {
  const digits = onlyDigits(number);
  if (digits.length < 13 || digits.length > 19) return false;

  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let digit = Number(digits[i]);
    if (double) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    double = !double;
  }
  return sum % 10 === 0;
}

function brandOf(number) {
  const digits = onlyDigits(number);
  if (/^4/.test(digits)) return 'Visa';
  if (/^(5[1-5]|2[2-7])/.test(digits)) return 'Mastercard';
  if (/^3[47]/.test(digits)) return 'American Express';
  if (/^6(?:011|5)/.test(digits)) return 'Discover';
  return 'Tarjeta';
}

function validateExpiry(expiry) {
  const match = String(expiry || '').match(/^(\d{2})\s*\/\s*(\d{2,4})$/);
  if (!match) return 'Ingresá el vencimiento con formato MM/AA.';

  const month = Number(match[1]);
  const yearPart = match[2];
  const year = yearPart.length === 2 ? 2000 + Number(yearPart) : Number(yearPart);

  if (month < 1 || month > 12) return 'El mes de vencimiento no es válido.';

  const now = new Date();
  const limit = new Date(year, month, 1);
  if (limit <= new Date(now.getFullYear(), now.getMonth(), 1)) {
    return 'La tarjeta está vencida.';
  }
  return null;
}

function reference() {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `SH-PAY-${stamp}-${random}`;
}

export class MockPaymentProvider extends PaymentProvider {
  /**
   * @param {{ amount:number, currency?:string, description?:string,
   *           card:{ number:string, holder:string, expiry:string, cvv:string } }} request
   */
  async charge({ amount, currency = 'USD', description = '', card }) {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      throw new PaymentError('El importe del pago no es válido.');
    }

    const number = String(card?.number || '').trim();
    const holder = String(card?.holder || '').trim();
    const expiry = String(card?.expiry || '').trim();
    const cvv = onlyDigits(card?.cvv);

    if (!holder || holder.length < 3) {
      throw new PaymentError('Ingresá el nombre del titular de la tarjeta.');
    }
    if (!luhnValid(number)) {
      throw new PaymentError('El número de tarjeta no es válido. Probá con 4242 4242 4242 4242.');
    }

    const expiryError = validateExpiry(expiry);
    if (expiryError) throw new PaymentError(expiryError);

    const expectedCvv = brandOf(number) === 'American Express' ? 4 : 3;
    if (cvv.length !== expectedCvv) {
      throw new PaymentError(`El CVV debe tener ${expectedCvv} dígitos.`);
    }

    // La pasarela simulada nunca rechaza una tarjeta válida.
    return {
      ok: true,
      provider: 'mock',
      reference: reference(),
      last4: onlyDigits(number).slice(-4),
      brand: brandOf(number),
      amount: value,
      currency,
      description,
      paidAt: new Date().toISOString(),
    };
  }
}

export const paymentProvider = new MockPaymentProvider();
