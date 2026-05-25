import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { toast } from '@/components/ui/toast';
import { login as loginApi } from '@/api/auth';
import { useAuthStore } from '@/store/auth.store';

const loginSchema = z.object({
  email: z.string().min(1, 'error.required').email('error.email'),
  password: z.string().min(1, 'error.required'),
});

type LoginData = z.infer<typeof loginSchema>;

export function LoginPage() {
  const { t } = useTranslation(['auth', 'common']);
  const navigate = useNavigate();
  const { setToken, setCurrentOrgId } = useAuthStore();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginData>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (data: LoginData): Promise<void> => {
    try {
      const result = await loginApi(data.email, data.password);
      setToken(result.token);
      setCurrentOrgId(result.orgId);
      void navigate('/app/dashboard');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('login.error.invalid', { ns: 'auth' });
      toast.error(message);
    }
  };

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">{t('login.title', { ns: 'auth' })}</CardTitle>
        <CardDescription>{t('login.subtitle', { ns: 'auth' })}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={(e) => { void handleSubmit(onSubmit)(e); }} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="email">{t('login.email', { ns: 'auth' })}</Label>
            <Input
              id="email"
              type="email"
              placeholder={t('login.email.placeholder', { ns: 'auth' })}
              autoComplete="email"
              {...register('email')}
            />
            {errors.email && <p className="text-xs text-red-500">{t(errors.email.message ?? 'error.required', { ns: 'common' })}</p>}
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">{t('login.password', { ns: 'auth' })}</Label>
              <Link to="/auth/forgot-password" className="text-xs text-[--accent] hover:underline">{t('login.forgot', { ns: 'auth' })}</Link>
            </div>
            <Input
              id="password"
              type="password"
              placeholder={t('login.password.placeholder', { ns: 'auth' })}
              autoComplete="current-password"
              {...register('password')}
            />
            {errors.password && <p className="text-xs text-red-500">{t(errors.password.message ?? 'error.required', { ns: 'common' })}</p>}
          </div>
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? t('btn.loading', { ns: 'common' }) : t('login.submit', { ns: 'auth' })}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="justify-center text-sm text-[--text-muted]">
        {t('login.noAccount', { ns: 'auth' })}&nbsp;
        <Link to="/auth/register" className="text-[--accent] hover:underline font-medium">{t('login.register', { ns: 'auth' })}</Link>
      </CardFooter>
    </Card>
  );
}
