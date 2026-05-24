import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';

const registerSchema = z
  .object({
    name: z.string().min(1, 'error.required'),
    email: z.string().min(1, 'error.required').email('error.email'),
    password: z.string().min(8, 'register.password.min'),
    confirm: z.string().min(1, 'error.required'),
  })
  .refine((d) => d.password === d.confirm, {
    message: 'register.confirm.mismatch',
    path: ['confirm'],
  });

type RegisterData = z.infer<typeof registerSchema>;

export function RegisterPage() {
  const { t } = useTranslation(['auth', 'common']);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterData>({ resolver: zodResolver(registerSchema) });

  const onSubmit = (_data: RegisterData): void => {
    // Placeholder — implémentation API en P-10b
  };

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">{t('register.title', { ns: 'auth' })}</CardTitle>
        <CardDescription>{t('register.subtitle', { ns: 'auth' })}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={(e) => { void handleSubmit(onSubmit)(e); }} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="name">{t('register.name', { ns: 'auth' })}</Label>
            <Input id="name" placeholder={t('register.name.placeholder', { ns: 'auth' })} autoComplete="name" {...register('name')} />
            {errors.name && <p className="text-xs text-red-500">{t(errors.name.message ?? 'error.required', { ns: 'common' })}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">{t('register.email', { ns: 'auth' })}</Label>
            <Input id="email" type="email" placeholder={t('register.email.placeholder', { ns: 'auth' })} autoComplete="email" {...register('email')} />
            {errors.email && <p className="text-xs text-red-500">{t(errors.email.message ?? 'error.required', { ns: 'common' })}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">{t('register.password', { ns: 'auth' })}</Label>
            <Input id="password" type="password" placeholder={t('register.password.placeholder', { ns: 'auth' })} autoComplete="new-password" {...register('password')} />
            {errors.password && <p className="text-xs text-red-500">{t(errors.password.message ?? 'error.required', { ns: 'common' })}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm">{t('register.confirm', { ns: 'auth' })}</Label>
            <Input id="confirm" type="password" placeholder={t('register.confirm.placeholder', { ns: 'auth' })} autoComplete="new-password" {...register('confirm')} />
            {errors.confirm && <p className="text-xs text-red-500">{t(errors.confirm.message ?? 'error.required', { ns: 'common' })}</p>}
          </div>
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? t('btn.loading', { ns: 'common' }) : t('register.submit', { ns: 'auth' })}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="justify-center text-sm text-[--text-muted]">
        {t('register.hasAccount', { ns: 'auth' })}&nbsp;
        <Link to="/auth/login" className="text-[--accent] hover:underline font-medium">{t('register.login', { ns: 'auth' })}</Link>
      </CardFooter>
    </Card>
  );
}
