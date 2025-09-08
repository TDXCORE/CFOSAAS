/**
 * Create Company Dialog
 * Form to create new Colombian companies with proper validation
 */

'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Building2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@kit/ui/form';
import { Input } from '@kit/ui/input';
import { Button } from '@kit/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { toast } from 'sonner';
import { useUser } from '@kit/supabase/hooks/use-user';
import { companiesService } from '~/lib/companies/companies-service';
import { useTenant } from '~/lib/companies/tenant-context';
import { 
  COLOMBIAN_DEPARTMENTS, 
  COLOMBIAN_CITIES, 
  COMPANY_SECTORS,
  type CreateCompanyInput 
} from '~/lib/companies/types';

// Form validation schema
const createCompanySchema = z.object({
  name: z.string().min(2, 'Company name must be at least 2 characters'),
  legal_name: z.string().min(2, 'Legal name must be at least 2 characters'),
  tax_id: z.string()
    .min(8, 'NIT must be at least 8 digits')
    .max(10, 'NIT must be at most 10 digits')
    .regex(/^\d+$/, 'NIT must contain only numbers'),
  fiscal_regime: z.enum(['simplified', 'common', 'special']).optional(),
  economic_activity_code: z.string().optional(),
  economic_activity_name: z.string().optional(),
  sector: z.enum([
    'manufacturing',
    'services', 
    'commerce',
    'technology',
    'construction',
    'transportation',
    'agriculture',
    'mining',
    'education',
    'healthcare',
    'finance',
    'real_estate',
    'hospitality',
    'other'
  ]).optional(),
  company_size: z.enum(['micro', 'small', 'medium', 'large']).optional(),
  department: z.string().optional(),
  city: z.string().optional(),
});

type CreateCompanyFormData = z.infer<typeof createCompanySchema>;

interface CreateCompanyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateCompanyDialog({ open, onOpenChange }: CreateCompanyDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const user = useUser();
  const { refreshCompanies, switchCompany } = useTenant();

  const form = useForm<CreateCompanyFormData>({
    resolver: zodResolver(createCompanySchema),
    defaultValues: {
      name: '',
      legal_name: '',
      tax_id: '',
      company_size: 'small',
      sector: 'services',
      fiscal_regime: 'common',
    },
  });

  const selectedDepartment = form.watch('department');
  const availableCities = selectedDepartment ? 
    Object.entries(COLOMBIAN_CITIES)
      .filter(([_, dept]) => dept === selectedDepartment)
      .map(([city, _]) => city) : [];

  const handleSubmit = async (data: CreateCompanyFormData) => {
    if (!user?.id) {
      toast.error('You must be logged in to create a company');
      return;
    }

    setIsSubmitting(true);

    try {
      const companyData: CreateCompanyInput = {
        name: data.name,
        legal_name: data.legal_name,
        tax_id: data.tax_id,
        fiscal_regime: data.fiscal_regime,
        economic_activity_code: data.economic_activity_code,
        economic_activity_name: data.economic_activity_name,
        sector: data.sector,
        company_size: data.company_size,
        department: data.department,
        city: data.city,
      };

      const { data: company, error } = await companiesService.createCompany(companyData, user.id);

      if (error || !company) {
        toast.error('Failed to create company: ' + (error || 'Unknown error'));
        return;
      }

      toast.success('Company created successfully');

      // Refresh companies list and switch to new company
      await refreshCompanies();
      await switchCompany(company.id);

      // Close dialog and reset form
      onOpenChange(false);
      form.reset();

    } catch (error) {
      console.error('Error creating company:', error);
      toast.error('An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (isSubmitting) return;
    onOpenChange(false);
    form.reset();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Building2 className="h-5 w-5 text-primary" />
            <span>Create New Company</span>
          </DialogTitle>
          <DialogDescription>
            Create a new Colombian company to start processing invoices and managing finances.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            {/* Basic Information */}
            <div className="space-y-4">
              <h4 className="font-medium text-sm">Basic Information</h4>
              
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company Name *</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="e.g., Acme Corp"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="legal_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Legal Name *</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="e.g., Acme Corp S.A.S."
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="tax_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>NIT (Colombian Tax ID) *</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="e.g., 900123456"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Tax Information */}
            <div className="space-y-4">
              <h4 className="font-medium text-sm">Tax Information</h4>
              
              <FormField
                control={form.control}
                name="fiscal_regime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fiscal Regime</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select fiscal regime" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="simplified">Simplified Regime</SelectItem>
                        <SelectItem value="common">Common Regime</SelectItem>
                        <SelectItem value="special">Special Regime</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="economic_activity_code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>CIIU Code</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="e.g., 6201"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="economic_activity_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Economic Activity</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="e.g., Software Development"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Company Classification */}
            <div className="space-y-4">
              <h4 className="font-medium text-sm">Company Classification</h4>
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="sector"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sector</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select sector" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {COMPANY_SECTORS.map((sector) => (
                            <SelectItem key={sector} value={sector}>
                              {sector.charAt(0).toUpperCase() + sector.slice(1).replace('_', ' ')}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="company_size"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company Size</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select size" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="micro">Micro (1-10 employees)</SelectItem>
                          <SelectItem value="small">Small (11-50 employees)</SelectItem>
                          <SelectItem value="medium">Medium (51-200 employees)</SelectItem>
                          <SelectItem value="large">Large (200+ employees)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Location */}
            <div className="space-y-4">
              <h4 className="font-medium text-sm">Location</h4>
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="department"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Department</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select department" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {COLOMBIAN_DEPARTMENTS.map((dept) => (
                            <SelectItem key={dept} value={dept}>
                              {dept}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>City</FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        value={field.value}
                        disabled={!selectedDepartment}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={
                              !selectedDepartment 
                                ? "Select department first" 
                                : "Select city"
                            } />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {availableCities.map((city) => (
                            <SelectItem key={city} value={city}>
                              {city}
                            </SelectItem>
                          ))}
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex justify-end space-x-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Company
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}