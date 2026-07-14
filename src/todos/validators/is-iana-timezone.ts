import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

export function isValidIanaTimeZone(value: unknown): boolean {
  if (typeof value !== 'string') {
    return false;
  }
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export function IsIanaTimeZone(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isIanaTimeZone',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          return isValidIanaTimeZone(value);
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} must be a valid IANA time zone`;
        },
      },
    });
  };
}
